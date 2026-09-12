import "server-only";

import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { cards, decks, notes, reviews } from "@/db/schema";
import { DAY_MS, startOfStudyDay, studyDayKey } from "@/lib/day";
import { State } from "@/lib/scheduler";
import { XP_PER_REVIEW } from "@/lib/stats-constants";

export { XP_PER_REVIEW } from "@/lib/stats-constants";

export interface DayBucket {
  date: string;
  count: number;
  /** Reviews that were graded Good or Easy. */
  correct: number;
  durationMs: number;
}

function dayKeyExpr() {
  // Shift by the 04:00 rollover before truncating to a date.
  return sql<string>`date((${reviews.reviewedAt} - ${4 * 3600_000}) / 1000, 'unixepoch', 'localtime')`;
}

export function reviewsByDay(sinceDays = 365, deckId?: number): DayBucket[] {
  const since = startOfStudyDay().getTime() - (sinceDays - 1) * DAY_MS;
  const key = dayKeyExpr();

  const rows = db
    .select({
      date: key,
      count: count(),
      correct: sql<number>`sum(case when ${reviews.rating} >= 3 then 1 else 0 end)`,
      durationMs: sql<number>`coalesce(sum(${reviews.durationMs}), 0)`,
    })
    .from(reviews)
    .where(
      and(
        gte(reviews.reviewedAt, since),
        deckId ? eq(reviews.deckId, deckId) : undefined,
      ),
    )
    .groupBy(key)
    .all();

  return rows.map((r) => ({
    date: r.date,
    count: r.count,
    correct: Number(r.correct ?? 0),
    durationMs: Number(r.durationMs ?? 0),
  }));
}

/** Dense day series (zero-filled) ending today - what the heatmap renders. */
export function heatmap(days = 365, deckId?: number): DayBucket[] {
  const byDate = new Map(reviewsByDay(days, deckId).map((d) => [d.date, d]));
  const today = startOfStudyDay();
  const out: DayBucket[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const at = new Date(today.getTime() - i * DAY_MS);
    const date = studyDayKey(at);
    out.push(byDate.get(date) ?? { date, count: 0, correct: 0, durationMs: 0 });
  }
  return out;
}

export interface Streak {
  current: number;
  longest: number;
  /** True when today already has at least one review - drives the lit flame. */
  litToday: boolean;
}

export function streak(deckId?: number): Streak {
  const days = reviewsByDay(3650, deckId)
    .filter((d) => d.count > 0)
    .map((d) => d.date)
    .sort();

  if (days.length === 0) return { current: 0, longest: 0, litToday: false };

  const set = new Set(days);
  const today = studyDayKey();
  const yesterday = studyDayKey(new Date(startOfStudyDay().getTime() - DAY_MS));
  const litToday = set.has(today);

  let current = 0;
  if (litToday || set.has(yesterday)) {
    let cursor = startOfStudyDay();
    if (!litToday) cursor = new Date(cursor.getTime() - DAY_MS);
    while (set.has(studyDayKey(cursor))) {
      current += 1;
      cursor = new Date(cursor.getTime() - DAY_MS);
    }
  }

  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of days) {
    const t = new Date(`${day}T00:00:00`).getTime();
    run = prev !== null && Math.round((t - prev) / DAY_MS) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }

  return { current, longest, litToday };
}

export interface StateDistribution {
  new: number;
  learning: number;
  review: number;
  relearning: number;
  suspended: number;
  total: number;
}

export function stateDistribution(deckId?: number): StateDistribution {
  const rows = db
    .select({ state: cards.state, suspended: cards.suspended, n: count() })
    .from(cards)
    .where(deckId ? eq(cards.deckId, deckId) : undefined)
    .groupBy(cards.state, cards.suspended)
    .all();

  const out: StateDistribution = {
    new: 0,
    learning: 0,
    review: 0,
    relearning: 0,
    suspended: 0,
    total: 0,
  };

  for (const row of rows) {
    out.total += row.n;
    if (row.suspended) {
      out.suspended += row.n;
      continue;
    }
    if (row.state === State.New) out.new += row.n;
    else if (row.state === State.Learning) out.learning += row.n;
    else if (row.state === State.Review) out.review += row.n;
    else out.relearning += row.n;
  }
  return out;
}

/**
 * True retention: of the cards that were already in the Review state, what
 * share were recalled (Hard/Good/Easy). Again on a mature card is the lapse.
 */
export function retention(sinceDays = 30, deckId?: number) {
  const since = startOfStudyDay().getTime() - (sinceDays - 1) * DAY_MS;

  const row = db
    .select({
      total: count(),
      passed: sql<number>`sum(case when ${reviews.rating} > 1 then 1 else 0 end)`,
    })
    .from(reviews)
    .where(
      and(
        gte(reviews.reviewedAt, since),
        eq(reviews.state, State.Review),
        deckId ? eq(reviews.deckId, deckId) : undefined,
      ),
    )
    .get();

  const total = row?.total ?? 0;
  const passed = Number(row?.passed ?? 0);
  return { total, passed, rate: total === 0 ? null : passed / total };
}

export function ratingBreakdown(sinceDays = 30, deckId?: number) {
  const since = startOfStudyDay().getTime() - (sinceDays - 1) * DAY_MS;
  const rows = db
    .select({ rating: reviews.rating, n: count() })
    .from(reviews)
    .where(
      and(
        gte(reviews.reviewedAt, since),
        deckId ? eq(reviews.deckId, deckId) : undefined,
      ),
    )
    .groupBy(reviews.rating)
    .all();

  const out = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const row of rows) {
    if (row.rating === 1) out.again = row.n;
    else if (row.rating === 2) out.hard = row.n;
    else if (row.rating === 3) out.good = row.n;
    else if (row.rating === 4) out.easy = row.n;
  }
  return out;
}

export function todaySummary(deckId?: number) {
  const dayStart = startOfStudyDay().getTime();
  const row = db
    .select({
      total: count(),
      newIntroduced: sql<number>`sum(case when ${reviews.state} = 0 then 1 else 0 end)`,
      durationMs: sql<number>`coalesce(sum(${reviews.durationMs}), 0)`,
    })
    .from(reviews)
    .where(
      and(
        gte(reviews.reviewedAt, dayStart),
        deckId ? eq(reviews.deckId, deckId) : undefined,
      ),
    )
    .get();

  const total = row?.total ?? 0;
  return {
    reviews: total,
    newIntroduced: Number(row?.newIntroduced ?? 0),
    durationMs: Number(row?.durationMs ?? 0),
    xp: total * XP_PER_REVIEW,
  };
}

export function lifetimeTotals() {
  const reviewRow = db
    .select({
      n: count(),
      durationMs: sql<number>`coalesce(sum(${reviews.durationMs}), 0)`,
    })
    .from(reviews)
    .get();

  return {
    reviews: reviewRow?.n ?? 0,
    durationMs: Number(reviewRow?.durationMs ?? 0),
    xp: (reviewRow?.n ?? 0) * XP_PER_REVIEW,
    cards: db.select({ n: count() }).from(cards).get()?.n ?? 0,
    notes: db.select({ n: count() }).from(notes).get()?.n ?? 0,
    decks: db.select({ n: count() }).from(decks).get()?.n ?? 0,
  };
}

export function perDeckTotals() {
  return db
    .select({
      deck: decks,
      cardCount: count(cards.id),
      reviewCount: sql<number>`(select count(*) from ${reviews} where ${reviews.deckId} = ${decks.id})`,
      matureCount: sql<number>`sum(case when ${cards.state} = 2 and ${cards.scheduledDays} >= 21 then 1 else 0 end)`,
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .groupBy(decks.id)
    .all()
    .map((row) => ({
      ...row,
      reviewCount: Number(row.reviewCount ?? 0),
      matureCount: Number(row.matureCount ?? 0),
    }));
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

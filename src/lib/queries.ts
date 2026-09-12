import "server-only";

import { and, asc, count, desc, eq, gt, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { cards, decks, notes, reviews, type Deck } from "@/db/schema";
import { endOfStudyDay, startOfStudyDay } from "@/lib/day";
import { noteMediaMaps } from "@/lib/media/store";
import { emptyMediaMap, type AttachedMedia, type NoteMediaMap } from "@/lib/media/types";
import { formatInterval, State } from "@/lib/scheduler";

export interface DeckCounts {
  /** New cards still allowed today. */
  newDue: number;
  /** Learning / relearning cards due now. */
  learningDue: number;
  /** Review cards due now, within today's review cap. */
  reviewDue: number;
  total: number;
  cardTotal: number;
}

export interface DeckWithCounts extends Deck {
  counts: DeckCounts;
}

function todayRange(now = new Date()) {
  return {
    dayStart: startOfStudyDay(now).getTime(),
    dayEnd: endOfStudyDay(now).getTime(),
  };
}

/**
 * How many new / review cards this deck has already burned through today.
 * Counted from the review log so it survives restarts and edits.
 */
function studiedToday(deckId: number, now = new Date()) {
  const { dayStart, dayEnd } = todayRange(now);

  const rows = db
    .select({
      state: reviews.state,
      n: count(),
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.deckId, deckId),
        gte(reviews.reviewedAt, dayStart),
        lte(reviews.reviewedAt, dayEnd),
      ),
    )
    .groupBy(reviews.state)
    .all();

  let introducedNew = 0;
  let reviewed = 0;
  for (const row of rows) {
    if (row.state === State.New) introducedNew += row.n;
    else reviewed += row.n;
  }
  return { introducedNew, reviewed };
}

export function getDeckCounts(deck: Deck, now = new Date()): DeckCounts {
  const nowMs = now.getTime();
  const { introducedNew, reviewed } = studiedToday(deck.id, now);

  const byState = db
    .select({ state: cards.state, n: count() })
    .from(cards)
    .where(
      and(
        eq(cards.deckId, deck.id),
        eq(cards.suspended, false),
        lte(cards.due, nowMs),
      ),
    )
    .groupBy(cards.state)
    .all();

  const pool = { new: 0, learning: 0, review: 0 };
  for (const row of byState) {
    if (row.state === State.New) pool.new += row.n;
    else if (row.state === State.Review) pool.review += row.n;
    else pool.learning += row.n;
  }

  const cardTotal =
    db
      .select({ n: count() })
      .from(cards)
      .where(eq(cards.deckId, deck.id))
      .get()?.n ?? 0;

  const newDue = Math.max(0, Math.min(pool.new, deck.newPerDay - introducedNew));
  const reviewDue = Math.max(
    0,
    Math.min(pool.review, deck.reviewsPerDay - reviewed),
  );
  // Learning cards are never capped - Anki always finishes a learning step.
  const learningDue = pool.learning;

  return {
    newDue,
    learningDue,
    reviewDue,
    total: newDue + learningDue + reviewDue,
    cardTotal,
  };
}

export function listDecks(includeArchived = false): DeckWithCounts[] {
  const now = new Date();
  const rows = db
    .select()
    .from(decks)
    .where(includeArchived ? undefined : eq(decks.archived, false))
    .orderBy(asc(decks.name))
    .all();

  return rows.map((deck) => ({ ...deck, counts: getDeckCounts(deck, now) }));
}

export function getDeck(id: number): Deck | undefined {
  return db.select().from(decks).where(eq(decks.id, id)).get();
}

/**
 * Everything the client needs to render a card and to compute the four
 * interval hints locally - ts-fsrs runs in the browser too, so the buttons
 * stay accurate without a round trip per card.
 */
export interface SessionCard {
  cardId: number;
  noteId: number;
  deckId: number;
  template: string;
  front: string;
  back: string;
  extra: string;
  tags: string[];
  /** Images and audio for the side being asked. */
  frontMedia: AttachedMedia[];
  /** Images and audio for the answer side, plus anything on `extra`. */
  backMedia: AttachedMedia[];
  extraMedia: AttachedMedia[];
  /** Raw ts-fsrs card state. */
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: number | null;
}

function toSessionCard(
  row: {
    card: typeof cards.$inferSelect;
    note: typeof notes.$inferSelect;
  },
  media: NoteMediaMap = emptyMediaMap(),
): SessionCard {
  const { card, note } = row;
  const reversed = card.template === "reverse";
  return {
    cardId: card.id,
    noteId: note.id,
    deckId: card.deckId,
    template: card.template,
    front: reversed ? note.back : note.front,
    back: reversed ? note.front : note.back,
    extra: note.extra,
    tags: safeTags(note.tags),
    // A reverse card asks the back, so its media swaps with the front's.
    frontMedia: reversed ? media.back : media.front,
    backMedia: reversed ? media.front : media.back,
    extraMedia: media.extra,
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsedDays,
    scheduledDays: card.scheduledDays,
    learningSteps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.lastReview,
  };
}

export function safeTags(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Builds the ordered study queue: due learning cards first (they are time
 * sensitive), then reviews, with the day's new cards spread evenly through the
 * rest so a session never ends with a wall of unseen words.
 */
export function buildQueue(deck: Deck, now = new Date()): SessionCard[] {
  const nowMs = now.getTime();
  const counts = getDeckCounts(deck, now);

  const pick = (where: ReturnType<typeof and>, limit: number, order = asc(cards.due)) =>
    limit <= 0
      ? []
      : db
          .select({ card: cards, note: notes })
          .from(cards)
          .innerJoin(notes, eq(cards.noteId, notes.id))
          .where(where)
          .orderBy(order)
          .limit(limit)
          .all();

  const base = and(
    eq(cards.deckId, deck.id),
    eq(cards.suspended, false),
    lte(cards.due, nowMs),
  );

  const learning = pick(
    and(base, ne(cards.state, State.New), ne(cards.state, State.Review)),
    counts.learningDue,
  );
  const review = pick(and(base, eq(cards.state, State.Review)), counts.reviewDue);
  const fresh = pick(
    and(eq(cards.deckId, deck.id), eq(cards.suspended, false), eq(cards.state, State.New)),
    counts.newDue,
    asc(cards.id),
  );

  const rows = interleave([...learning, ...review], fresh);

  // One query for the whole queue rather than one per card.
  const media = noteMediaMaps(rows.map((row) => row.note.id));
  return rows.map((row) => toSessionCard(row, media[row.note.id]));
}

/** Spreads `extra` evenly through `main` while preserving both orders. */
function interleave<T>(main: T[], extra: T[]): T[] {
  if (extra.length === 0) return main;
  if (main.length === 0) return extra;

  const out: T[] = [];
  const step = main.length / (extra.length + 1);
  let nextExtra = 0;

  for (let i = 0; i < main.length; i++) {
    while (nextExtra < extra.length && i >= step * (nextExtra + 1)) {
      out.push(extra[nextExtra++]);
    }
    out.push(main[i]);
  }
  while (nextExtra < extra.length) out.push(extra[nextExtra++]);
  return out;
}

export interface BrowseFilters {
  search?: string;
  state?: number | "all";
  page?: number;
  perPage?: number;
}

export interface BrowseRow {
  card: typeof cards.$inferSelect;
  note: typeof notes.$inferSelect;
  /** Rendered here so the page component never has to read the clock. */
  dueLabel: string;
  media: NoteMediaMap;
}

export function browseCards(deckId: number, filters: BrowseFilters = {}) {
  const perPage = filters.perPage ?? 50;
  const page = Math.max(1, filters.page ?? 1);
  const now = Date.now();

  const clauses = [eq(cards.deckId, deckId)];
  if (filters.search) {
    const needle = `%${filters.search.toLowerCase()}%`;
    clauses.push(
      sql`(lower(${notes.front}) like ${needle} or lower(${notes.back}) like ${needle} or lower(${notes.extra}) like ${needle})`,
    );
  }
  if (typeof filters.state === "number") {
    clauses.push(eq(cards.state, filters.state));
  }
  const where = and(...clauses);

  const total =
    db
      .select({ n: count() })
      .from(cards)
      .innerJoin(notes, eq(cards.noteId, notes.id))
      .where(where)
      .get()?.n ?? 0;

  const pageRows = db
    .select({ card: cards, note: notes })
    .from(cards)
    .innerJoin(notes, eq(cards.noteId, notes.id))
    .where(where)
    .orderBy(asc(cards.due), asc(cards.id))
    .limit(perPage)
    .offset((page - 1) * perPage)
    .all();

  const mediaByNote = noteMediaMaps(pageRows.map((row) => row.note.id));

  const rows: BrowseRow[] = pageRows.map((row) => ({
    ...row,
    dueLabel:
      row.card.state === State.New
        ? "-"
        : row.card.due <= now
          ? "now"
          : `in ${formatInterval(row.card.due - now)}`,
    media: mediaByNote[row.note.id] ?? emptyMediaMap(),
  }));

  return { rows, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export function getNote(noteId: number) {
  return db.select().from(notes).where(eq(notes.id, noteId)).get();
}

export function getNoteMedia(noteId: number): NoteMediaMap {
  return noteMediaMaps([noteId])[noteId] ?? emptyMediaMap();
}

/** Cards due per day for the next `days` days, for the forecast chart. */
export function dueForecast(days = 30, deckId?: number) {
  const start = startOfStudyDay().getTime();
  const rows = db
    .select({ due: cards.due, state: cards.state })
    .from(cards)
    .where(
      and(
        eq(cards.suspended, false),
        ne(cards.state, State.New),
        deckId ? eq(cards.deckId, deckId) : undefined,
        lte(cards.due, start + (days + 1) * 86_400_000),
      ),
    )
    .all();

  const buckets = Array.from({ length: days }, (_, i) => ({ day: i, count: 0 }));
  for (const row of rows) {
    const offset = Math.max(0, Math.floor((row.due - start) / 86_400_000));
    if (offset < days) buckets[offset].count += 1;
  }
  return buckets;
}

export function recentReviews(limit = 10) {
  return db
    .select({ review: reviews, note: notes, deck: decks })
    .from(reviews)
    .innerJoin(cards, eq(reviews.cardId, cards.id))
    .innerJoin(notes, eq(cards.noteId, notes.id))
    .innerJoin(decks, eq(reviews.deckId, decks.id))
    .orderBy(desc(reviews.reviewedAt))
    .limit(limit)
    .all();
}

export function decksByIds(ids: number[]) {
  if (ids.length === 0) return [];
  return db.select().from(decks).where(inArray(decks.id, ids)).all();
}

export function hasAnyDeck(): boolean {
  return (db.select({ n: count() }).from(decks).get()?.n ?? 0) > 0;
}

export function cardsDueLater(deckId: number, now = new Date()) {
  return (
    db
      .select({ n: count() })
      .from(cards)
      .where(
        and(
          eq(cards.deckId, deckId),
          eq(cards.suspended, false),
          gt(cards.due, now.getTime()),
        ),
      )
      .get()?.n ?? 0
  );
}

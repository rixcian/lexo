import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
  type RecordLogItem,
} from "ts-fsrs";
import type { Card } from "@/db/schema";

export { Rating, State };
export type { Grade };

/** The four grades a reviewer can give, in the order they are rendered. */
export const GRADES = [
  Rating.Again,
  Rating.Hard,
  Rating.Good,
  Rating.Easy,
] as const satisfies readonly Grade[];

export interface SchedulerConfig {
  /** Target probability of recall at review time. Anki's default is 0.9. */
  requestRetention: number;
  /** Days. Caps how far into the future a card can be pushed. */
  maximumInterval: number;
  /** Randomizes intervals slightly so same-day batches do not clump. */
  enableFuzz: boolean;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  requestRetention: 0.9,
  maximumInterval: 36500,
  enableFuzz: true,
};

export function scheduler(config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG) {
  return fsrs(
    generatorParameters({
      request_retention: config.requestRetention,
      maximum_interval: config.maximumInterval,
      enable_fuzz: config.enableFuzz,
    }),
  );
}

/** The FSRS state a brand-new card starts life in. */
export function newCardState(now: Date = new Date()) {
  return fromFsrsCard(createEmptyCard(now));
}

/** The scheduling columns, shared by DB rows and the client session payload. */
export interface FsrsState {
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

export function toFsrsCard(card: FsrsState): FsrsCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: card.lastReview ? new Date(card.lastReview) : undefined,
  };
}

export function fromFsrsCard(card: FsrsCard) {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as number,
    lastReview: card.last_review ? card.last_review.getTime() : null,
  };
}

/**
 * Grades a card. Returns the column updates for `cards` and the row to append
 * to `reviews`, so the caller can write both inside one transaction.
 */
export function gradeCard(
  card: Card,
  rating: Grade,
  now: Date,
  config?: SchedulerConfig,
) {
  const item: RecordLogItem = scheduler(config).next(
    toFsrsCard(card),
    now,
    rating,
  );

  return {
    cardUpdate: fromFsrsCard(item.card),
    reviewRow: {
      cardId: card.id,
      deckId: card.deckId,
      rating: item.log.rating as number,
      state: item.log.state as number,
      due: item.log.due.getTime(),
      stability: item.log.stability,
      difficulty: item.log.difficulty,
      elapsedDays: item.log.elapsed_days,
      lastElapsedDays: item.log.last_elapsed_days,
      scheduledDays: item.log.scheduled_days,
      reviewedAt: item.log.review.getTime(),
    },
  };
}

/**
 * The "+10min / +1d / +4d / +9d" hints printed on the four grade buttons.
 */
export function previewIntervals(
  card: FsrsState,
  now: Date,
  config?: SchedulerConfig,
): Record<Grade, string> {
  const preview = scheduler(config).repeat(toFsrsCard(card), now);
  const out = {} as Record<Grade, string>;
  for (const grade of GRADES) {
    out[grade] = formatInterval(preview[grade].card.due.getTime() - now.getTime());
  }
  return out;
}

/** Compact, Anki-style duration label. */
export function formatInterval(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.round(ms / 86_400_000);
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(days < 3650 ? 1 : 0)}y`;
}

export const STATE_LABEL: Record<number, string> = {
  [State.New]: "New",
  [State.Learning]: "Learning",
  [State.Review]: "Review",
  [State.Relearning]: "Relearning",
};

/** DESIGN.md section 2: each grade owns one gamification accent. */
export const GRADE_META: Record<
  Grade,
  { label: string; variant: string; key: string }
> = {
  [Rating.Again]: { label: "Again", variant: "duo-danger", key: "1" },
  [Rating.Hard]: { label: "Hard", variant: "duo-warning", key: "2" },
  [Rating.Good]: { label: "Good", variant: "duo", key: "3" },
  [Rating.Easy]: { label: "Easy", variant: "duo-info", key: "4" },
};

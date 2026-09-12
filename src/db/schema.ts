import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Decks are language-agnostic: `frontLang`/`backLang` are free-form BCP-47-ish
 * tags so the same app holds Spanish, Japanese or pure-trivia decks.
 */
export const decks = sqliteTable(
  "decks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    frontLang: text("front_lang").notNull().default(""),
    backLang: text("back_lang").notNull().default(""),
    /** One of the DESIGN.md section 2 accent roles - drives the unit color. */
    color: text("color").notNull().default("brand"),
    newPerDay: integer("new_per_day").notNull().default(20),
    reviewsPerDay: integer("reviews_per_day").notNull().default(200),
    /** Generate a reverse (back to front) card for every new note. */
    reverseCards: integer("reverse_cards", { mode: "boolean" })
      .notNull()
      .default(false),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("decks_archived_idx").on(t.archived)],
);

export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deckId: integer("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    /** Example sentence, mnemonic, gender, conjugation notes. */
    extra: text("extra").notNull().default(""),
    /** JSON array of strings. */
    tags: text("tags").notNull().default("[]"),
    /** Hash of the normalized front+back - used to skip duplicate imports. */
    fingerprint: text("fingerprint").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("notes_deck_idx").on(t.deckId),
    uniqueIndex("notes_deck_fingerprint_idx").on(t.deckId, t.fingerprint),
  ],
);

/**
 * One row per scheduled direction of a note. Columns mirror the `Card` shape
 * of ts-fsrs so conversion is a straight field map.
 */
export const cards = sqliteTable(
  "cards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    noteId: integer("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    deckId: integer("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    /** "forward" = front to back, "reverse" = back to front. */
    template: text("template").notNull().default("forward"),
    /** Unix ms. */
    due: integer("due").notNull(),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    elapsedDays: real("elapsed_days").notNull().default(0),
    scheduledDays: real("scheduled_days").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    /** ts-fsrs State: 0 New, 1 Learning, 2 Review, 3 Relearning. */
    state: integer("state").notNull().default(0),
    lastReview: integer("last_review"),
    suspended: integer("suspended", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    uniqueIndex("cards_note_template_idx").on(t.noteId, t.template),
    index("cards_deck_due_idx").on(t.deckId, t.due),
    index("cards_due_idx").on(t.due),
    index("cards_state_idx").on(t.state),
  ],
);

/** Append-only review log - the source of truth for every statistic. */
export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cardId: integer("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    deckId: integer("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    /** ts-fsrs Rating: 1 Again, 2 Hard, 3 Good, 4 Easy. */
    rating: integer("rating").notNull(),
    /** Card state *before* this review. */
    state: integer("state").notNull(),
    due: integer("due").notNull(),
    stability: real("stability").notNull(),
    difficulty: real("difficulty").notNull(),
    elapsedDays: real("elapsed_days").notNull(),
    lastElapsedDays: real("last_elapsed_days").notNull(),
    scheduledDays: real("scheduled_days").notNull(),
    reviewedAt: integer("reviewed_at").notNull(),
    durationMs: integer("duration_ms").notNull().default(0),
  },
  (t) => [
    index("reviews_reviewed_at_idx").on(t.reviewedAt),
    index("reviews_deck_idx").on(t.deckId),
    index("reviews_card_idx").on(t.cardId),
  ],
);

/** Single-row-per-key app settings (JSON-encoded values). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Deck = typeof decks.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Review = typeof reviews.$inferSelect;

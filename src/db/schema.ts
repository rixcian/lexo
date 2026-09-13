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
 * Accounts are deliberately thin: a username is the whole credential. The app
 * is meant to run on a private network for a household, so there is no
 * password to forget - signing in is picking your name off a list.
 *
 * Row 1 is seeded by the migration with an empty username. It owns every deck,
 * card and review that predates accounts, and the first registration claims it
 * rather than inserting a new row - that is how an existing collection keeps
 * its scheduling and its streak.
 */
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Display spelling. Uniqueness is enforced case-insensitively in code. */
    username: text("username").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("users_username_idx").on(t.username)],
);

/**
 * Server-side sessions. The cookie carries a random token; only its sha256
 * lands here, so a copy of the database is not a set of live logins.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    /** sha256 of the cookie token, hex. */
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

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
 * Content-addressed store for the images and audio clips attached to notes.
 * `hash` is the sha256 of the bytes, so the same file imported from two decks
 * is stored once; it doubles as the on-disk name and the URL segment.
 */
export const media = sqliteTable(
  "media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    hash: text("hash").notNull(),
    /** Original name from the .apkg or the upload - shown, never trusted. */
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("media_hash_idx").on(t.hash)],
);

/**
 * Attaches a media file to one field of a note. A field can hold several files
 * and a file can be reused by many notes, so this stays a join table rather
 * than columns on `notes`.
 */
export const noteMedia = sqliteTable(
  "note_media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    noteId: integer("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    mediaId: integer("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    /** "front" | "back" | "extra" - the field the file belongs to. */
    field: text("field").notNull(),
    /** Order within the field. */
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("note_media_note_idx").on(t.noteId),
    index("note_media_media_idx").on(t.mediaId),
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
    /**
     * Whose progress this row is. Decks and notes are shared by the whole
     * household; the schedule is not, so every user gets their own card row
     * per note and template.
     *
     * The column carries a DEFAULT so the migration could backfill the rows
     * that predate accounts onto user 1 without rebuilding the table - never
     * lean on it when inserting, always pass the user explicitly.
     */
    userId: integer("user_id").notNull().default(1),
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
    uniqueIndex("cards_user_note_template_idx").on(t.userId, t.noteId, t.template),
    index("cards_user_deck_due_idx").on(t.userId, t.deckId, t.due),
    index("cards_user_state_idx").on(t.userId, t.state),
    // Deleting a note cascades by note_id, which is no longer the leading
    // column of any other index.
    index("cards_note_idx").on(t.noteId),
  ],
);

/** Append-only review log - the source of truth for every statistic. */
export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** See `cards.userId` - same reasoning, same backfill default. */
    userId: integer("user_id").notNull().default(1),
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
    index("reviews_user_reviewed_at_idx").on(t.userId, t.reviewedAt),
    index("reviews_user_deck_idx").on(t.userId, t.deckId, t.reviewedAt),
    index("reviews_card_idx").on(t.cardId),
  ],
);

/** Single-row-per-key app settings (JSON-encoded values). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type User = typeof users.$inferSelect;
export type Deck = typeof decks.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Media = typeof media.$inferSelect;
export type NoteMedia = typeof noteMedia.$inferSelect;

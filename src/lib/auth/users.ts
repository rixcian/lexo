import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { db, sqlite } from "@/db";
import { cards, notes, users, type User } from "@/db/schema";
import { newCardState } from "@/lib/scheduler";

export { validateUsername, USERNAME_MAX, USERNAME_MIN } from "@/lib/auth/username";

/**
 * The username of the row the migration seeded. It owns everything that
 * predates accounts, and the first registration renames it rather than
 * inserting a new account - see `drizzle/0002_*.sql`.
 */
const UNCLAIMED = "";

/** Every account that has actually been registered, oldest first. */
export function listUsers(): User[] {
  return db
    .select()
    .from(users)
    .where(sql`${users.username} <> ${UNCLAIMED}`)
    .orderBy(asc(users.id))
    .all();
}

export function getUser(id: number): User | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}

/** Ids of everyone a new note has to be scheduled for. */
export function userIds(): number[] {
  return listUsers().map((user) => user.id);
}

export function usernameTaken(username: string): boolean {
  return Boolean(
    db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
      .get(),
  );
}

/**
 * Registers an account. The first one to arrive claims the seeded row so the
 * collection that predates accounts - decks, schedule, streak - becomes theirs;
 * everyone after that gets a fresh row plus their own copy of the schedule.
 */
export function createUser(username: string): User {
  return sqlite.transaction(() => {
    const unclaimed = db
      .select()
      .from(users)
      .where(eq(users.username, UNCLAIMED))
      .get();

    const user = unclaimed
      ? db
          .update(users)
          .set({ username, createdAt: Date.now() })
          .where(eq(users.id, unclaimed.id))
          .returning()
          .get()
      : db.insert(users).values({ username }).returning().get();

    provisionCards(user.id);
    return user;
  })();
}

/**
 * Gives `userId` a card for every (note, template) pair the collection already
 * has and they are missing. Claiming the seeded row is a no-op here - those
 * cards are already theirs - so this only ever does work for the second person
 * to sign up, and for notes added while an account did not exist yet.
 */
export function provisionCards(userId: number) {
  const fresh = newCardState();

  // Templates are a property of the note, so the pairs to copy are whatever
  // any other user already has. A note nobody has a card for (only possible
  // for a half-failed import) falls back to a single forward card.
  const pairs = db
    .selectDistinct({ noteId: notes.id, deckId: notes.deckId, template: cards.template })
    .from(notes)
    .leftJoin(cards, eq(cards.noteId, notes.id))
    .all()
    .map((row) => ({ ...row, template: row.template ?? "forward" }));

  if (pairs.length === 0) return 0;

  const mine = new Set(
    db
      .select({ noteId: cards.noteId, template: cards.template })
      .from(cards)
      .where(eq(cards.userId, userId))
      .all()
      .map((row) => `${row.noteId}:${row.template}`),
  );

  const missing = pairs.filter((pair) => !mine.has(`${pair.noteId}:${pair.template}`));
  if (missing.length === 0) return 0;

  // Same bound-parameter ceiling the importer works around.
  const CHUNK = 200;
  sqlite.transaction(() => {
    for (let i = 0; i < missing.length; i += CHUNK) {
      db.insert(cards)
        .values(
          missing.slice(i, i + CHUNK).map((pair) => ({
            userId,
            noteId: pair.noteId,
            deckId: pair.deckId,
            template: pair.template,
            ...fresh,
          })),
        )
        .run();
    }
  })();

  return missing.length;
}

/** True once somebody has registered - drives the login / register split. */
export function hasAccounts(): boolean {
  return listUsers().length > 0;
}

export type { User };

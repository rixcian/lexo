import "server-only";

import { and, eq } from "drizzle-orm";
import { db, sqlite } from "@/db";
import { cards, decks, notes } from "@/db/schema";
import { fingerprint } from "@/lib/fingerprint";
import { newCardState } from "@/lib/scheduler";
import type { ImportSummary, ParsedDeck, ParseResult } from "./types";

export interface IngestOptions {
  /** Put every parsed deck into this existing deck instead of creating new ones. */
  targetDeckId?: number;
  /** Merge all parsed decks into a single new deck with this name. */
  mergeInto?: string;
  color?: string;
  frontLang?: string;
  backLang?: string;
  reverseCards?: boolean;
}

/** SQLite caps bound parameters per statement; 200 rows stays well under it. */
const CHUNK = 200;

function chunked<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function findOrCreateDeck(name: string, options: IngestOptions) {
  const existing = db.select().from(decks).where(eq(decks.name, name)).get();
  if (existing) return existing;

  return db
    .insert(decks)
    .values({
      name,
      color: options.color ?? "brand",
      frontLang: options.frontLang ?? "",
      backLang: options.backLang ?? "",
      reverseCards: options.reverseCards ?? false,
    })
    .returning()
    .get();
}

function ingestOne(parsed: ParsedDeck, options: IngestOptions): ImportSummary {
  const deck =
    options.targetDeckId !== undefined
      ? db.select().from(decks).where(eq(decks.id, options.targetDeckId)).get()
      : findOrCreateDeck(options.mergeInto?.trim() || parsed.name, options);

  if (!deck) throw new Error("Target deck not found");

  const seen = new Set(
    db
      .select({ fingerprint: notes.fingerprint })
      .from(notes)
      .where(eq(notes.deckId, deck.id))
      .all()
      .map((row) => row.fingerprint),
  );

  const now = Date.now();
  const fresh = newCardState(new Date(now));
  const templates = deck.reverseCards ? ["forward", "reverse"] : ["forward"];

  const pending: (typeof notes.$inferInsert)[] = [];
  let duplicates = 0;

  for (const note of parsed.notes) {
    const fp = fingerprint(note.front, note.back);
    if (seen.has(fp)) {
      duplicates += 1;
      continue;
    }
    seen.add(fp);
    pending.push({
      deckId: deck.id,
      front: note.front,
      back: note.back,
      extra: note.extra,
      tags: JSON.stringify(note.tags),
      fingerprint: fp,
      createdAt: now,
      updatedAt: now,
    });
  }

  let cardsCreated = 0;

  sqlite.transaction(() => {
    for (const batch of chunked(pending)) {
      const inserted = db
        .insert(notes)
        .values(batch)
        .returning({ id: notes.id })
        .all();

      const cardRows = inserted.flatMap((note) =>
        templates.map((template) => ({
          noteId: note.id,
          deckId: deck.id,
          template,
          ...fresh,
        })),
      );

      for (const cardBatch of chunked(cardRows)) {
        db.insert(cards).values(cardBatch).run();
        cardsCreated += cardBatch.length;
      }
    }
  })();

  return {
    deckId: deck.id,
    deckName: deck.name,
    created: pending.length,
    duplicates,
    cardsCreated,
  };
}

export function ingest(
  result: ParseResult,
  options: IngestOptions = {},
): ImportSummary[] {
  const nonEmpty = result.decks.filter((deck) => deck.notes.length > 0);
  if (nonEmpty.length === 0) {
    throw new Error("Nothing to import - no rows had both a front and a back.");
  }

  // Merging into one deck means one pass over the concatenated notes, so the
  // duplicate check sees everything at once.
  if (options.targetDeckId !== undefined || options.mergeInto) {
    const merged: ParsedDeck = {
      name: options.mergeInto?.trim() || nonEmpty[0].name,
      notes: nonEmpty.flatMap((deck) => deck.notes),
    };
    return [ingestOne(merged, options)];
  }

  return nonEmpty.map((deck) => ingestOne(deck, options));
}

export function deckNameTaken(name: string): boolean {
  return Boolean(
    db
      .select({ id: decks.id })
      .from(decks)
      .where(and(eq(decks.name, name)))
      .get(),
  );
}

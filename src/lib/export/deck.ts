import "server-only";

import fs from "node:fs";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cards, decks, notes, reviews, type Deck } from "@/db/schema";
import { filePath, noteMediaMaps } from "@/lib/media/store";
import { emptyMediaMap, type AttachedMedia, type NoteMediaMap } from "@/lib/media/types";
import { safeTags } from "@/lib/queries";

export interface ExportCard {
  id: number;
  template: string;
  due: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: number | null;
  suspended: boolean;
}

export interface ExportNote {
  id: number;
  front: string;
  back: string;
  extra: string;
  tags: string[];
  createdAt: number;
  media: NoteMediaMap;
  cards: ExportCard[];
}

export interface ExportReview {
  cardId: number;
  rating: number;
  scheduledDays: number;
  lastElapsedDays: number;
  reviewedAt: number;
  durationMs: number;
  state: number;
}

export interface DeckExport {
  deck: Deck;
  notes: ExportNote[];
  reviews: ExportReview[];
  /** Every distinct file the notes reference, deduplicated by media id. */
  media: AttachedMedia[];
}

/**
 * Everything needed to write a deck back out. Read in one pass rather than per
 * note, since a big deck is thousands of rows and the writers want it all in
 * memory anyway.
 */
export function readDeckForExport(
  userId: number,
  deckId: number,
): DeckExport | null {
  const deck = db.select().from(decks).where(eq(decks.id, deckId)).get();
  if (!deck) return null;

  const noteRows = db
    .select()
    .from(notes)
    .where(eq(notes.deckId, deckId))
    .orderBy(asc(notes.id))
    .all();

  // The notes are the household's; the schedule and the history written out
  // with them are the exporting user's own.
  const cardRows = db
    .select()
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.deckId, deckId)))
    .orderBy(asc(cards.id))
    .all();

  const reviewRows = db
    .select()
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.deckId, deckId)))
    .orderBy(asc(reviews.reviewedAt))
    .all();

  const mediaByNote = noteMediaMaps(noteRows.map((note) => note.id));

  const cardsByNote = new Map<number, ExportCard[]>();
  for (const card of cardRows) {
    const bucket = cardsByNote.get(card.noteId) ?? [];
    bucket.push({
      id: card.id,
      template: card.template,
      due: card.due,
      scheduledDays: card.scheduledDays,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      lastReview: card.lastReview,
      suspended: card.suspended,
    });
    cardsByNote.set(card.noteId, bucket);
  }

  const media = new Map<number, AttachedMedia>();
  const exported: ExportNote[] = noteRows.map((note) => {
    const noteMedia = mediaByNote[note.id] ?? emptyMediaMap();
    for (const field of ["front", "back", "extra"] as const) {
      for (const file of noteMedia[field]) media.set(file.mediaId, file);
    }
    return {
      id: note.id,
      front: note.front,
      back: note.back,
      extra: note.extra,
      tags: safeTags(note.tags),
      createdAt: note.createdAt,
      media: noteMedia,
      cards: cardsByNote.get(note.id) ?? [],
    };
  });

  return {
    deck,
    notes: exported,
    reviews: reviewRows.map((row) => ({
      cardId: row.cardId,
      rating: row.rating,
      scheduledDays: row.scheduledDays,
      lastElapsedDays: row.lastElapsedDays,
      reviewedAt: row.reviewedAt,
      durationMs: row.durationMs,
      state: row.state,
    })),
    media: [...media.values()],
  };
}

/** Reads a stored file back off disk, or null if the row outlived its bytes. */
export function readMediaBytes(file: AttachedMedia): Uint8Array | null {
  try {
    return fs.readFileSync(filePath(file.hash));
  } catch {
    return null;
  }
}

/** Slug for the download filename - never trust a deck name in a header. */
export function exportFilename(deckName: string, extension: string): string {
  const slug =
    deckName
      .replace(/::/g, "-")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .toLowerCase() || "deck";
  return `${slug}.${extension}`;
}

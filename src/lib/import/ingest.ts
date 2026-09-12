import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db, sqlite } from "@/db";
import { cards, decks, notes } from "@/db/schema";
import { fingerprint } from "@/lib/fingerprint";
import { attachMedia, storeMedia } from "@/lib/media/store";
import { MEDIA_FIELDS, type MediaField } from "@/lib/media/types";
import { newCardState } from "@/lib/scheduler";
import type {
  ImportSummary,
  NoteMediaRef,
  ParsedDeck,
  ParsedMediaFile,
  ParseResult,
} from "./types";

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

/** Hands back the bytes of a parsed media file, or null if they are gone. */
export type MediaLoader = (file: ParsedMediaFile) => Uint8Array | null;

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

/** Media row ids for one note's references, grouped by field. */
type ResolvedMedia = Record<MediaField, number[]>;

/**
 * Moves parsed files into the media store on first use and remembers the row
 * id, so a clip shared by fifty notes is read and written once.
 */
function mediaImporter(files: ParsedMediaFile[], load: MediaLoader) {
  const catalogue = new Map(files.map((file) => [file.hash, file]));
  const byHash = new Map<string, number | null>();

  function idFor(hash: string): number | null {
    const cached = byHash.get(hash);
    if (cached !== undefined) return cached;

    const file = catalogue.get(hash);
    const bytes = file ? load(file) : null;
    const row =
      file && bytes
        ? storeMedia({ filename: file.filename, bytes, declaredMime: file.mime })
        : null;

    const id = row?.id ?? null;
    byHash.set(hash, id);
    return id;
  }

  return {
    resolve(refs: NoteMediaRef[]): ResolvedMedia {
      const out: ResolvedMedia = { front: [], back: [], extra: [] };
      for (const ref of refs) {
        const id = idFor(ref.hash);
        if (id !== null) out[ref.field].push(id);
      }
      return out;
    },
  };
}

function ingestOne(
  parsed: ParsedDeck,
  options: IngestOptions,
  media: ReturnType<typeof mediaImporter>,
): ImportSummary {
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

  const pending: {
    row: typeof notes.$inferInsert;
    media: NoteMediaRef[];
  }[] = [];
  let duplicates = 0;

  for (const note of parsed.notes) {
    // Only front and back media identify a note - the same reasoning that
    // leaves `extra` out of the text fingerprint.
    const identifying = note.media
      .filter((ref) => ref.field !== "extra")
      .map((ref) => ref.hash);
    const fp = fingerprint(note.front, note.back, identifying);

    if (seen.has(fp)) {
      duplicates += 1;
      continue;
    }
    seen.add(fp);
    pending.push({
      media: note.media,
      row: {
        deckId: deck.id,
        front: note.front,
        back: note.back,
        extra: note.extra,
        tags: JSON.stringify(note.tags),
        fingerprint: fp,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  let cardsCreated = 0;
  let mediaAttached = 0;

  sqlite.transaction(() => {
    for (const batch of chunked(pending)) {
      db.insert(notes)
        .values(batch.map((item) => item.row))
        .run();

      // SQLite does not promise an order for multi-row RETURNING, and the
      // fingerprint is unique per deck - so read the ids back by that.
      const idByFingerprint = new Map(
        db
          .select({ id: notes.id, fingerprint: notes.fingerprint })
          .from(notes)
          .where(
            and(
              eq(notes.deckId, deck.id),
              inArray(
                notes.fingerprint,
                batch.map((item) => item.row.fingerprint),
              ),
            ),
          )
          .all()
          .map((row) => [row.fingerprint, row.id] as const),
      );

      const cardRows: (typeof cards.$inferInsert)[] = [];
      for (const item of batch) {
        const noteId = idByFingerprint.get(item.row.fingerprint);
        if (noteId === undefined) continue;

        for (const template of templates) {
          cardRows.push({ noteId, deckId: deck.id, template, ...fresh });
        }

        if (item.media.length === 0) continue;
        const resolved = media.resolve(item.media);
        for (const field of MEDIA_FIELDS) {
          attachMedia(noteId, field, resolved[field]);
          mediaAttached += resolved[field].length;
        }
      }

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
    mediaAttached,
  };
}

export function ingest(
  result: ParseResult,
  options: IngestOptions = {},
  loadMedia: MediaLoader = () => null,
): ImportSummary[] {
  const nonEmpty = result.decks.filter((deck) => deck.notes.length > 0);
  if (nonEmpty.length === 0) {
    throw new Error("Nothing to import - no rows had both a front and a back.");
  }

  const media = mediaImporter(result.media ?? [], loadMedia);

  // Merging into one deck means one pass over the concatenated notes, so the
  // duplicate check sees everything at once.
  if (options.targetDeckId !== undefined || options.mergeInto) {
    const merged: ParsedDeck = {
      name: options.mergeInto?.trim() || nonEmpty[0].name,
      notes: nonEmpty.flatMap((deck) => deck.notes),
    };
    return [ingestOne(merged, options, media)];
  }

  return nonEmpty.map((deck) => ingestOne(deck, options, media));
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

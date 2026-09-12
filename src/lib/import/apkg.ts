import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { unzipSync } from "fflate";
import { decompress as zstdDecompress } from "fzstd";
import { readMediaFile, readMediaManifest } from "./apkg-media";
import { normalizeTags, stripAnkiHtml } from "./text";
import type {
  NoteMediaRef,
  ParsedDeck,
  ParsedMediaFile,
  ParsedNote,
  ParseResult,
} from "./types";
import { resolveMime, sha256 } from "@/lib/media/store";
import type { MediaField } from "@/lib/media/types";

/** Anki separates the fields of a note with the unit separator, 0x1f. */
const FIELD_SEPARATOR = "\u001f";

/** Candidate collection names, newest export format first. */
const COLLECTION_FILES = [
  "collection.anki21b",
  "collection.anki21",
  "collection.anki2",
] as const;

interface AnkiNoteRow {
  id: number;
  mid: number;
  flds: string;
  tags: string;
}

interface AnkiCardRow {
  nid: number;
  did: number;
}

/**
 * Parses an Anki `.apkg` export.
 *
 * Supported: the plain-SQLite collections (`collection.anki2` / `.anki21`) and
 * the zstd-compressed `collection.anki21b` written by modern Anki. Deck
 * hierarchy is flattened into "Parent::Child" names.
 *
 * Images and audio referenced by a field are pulled out of the archive and
 * attached to the note. Not imported: note templates and the original
 * scheduling history - every card starts as New under this app's FSRS
 * scheduler.
 */
export function parseApkg(buffer: Buffer): ParseResult {
  const warnings: string[] = [];
  const files = unzipSync(new Uint8Array(buffer));

  const name = COLLECTION_FILES.find((candidate) => files[candidate]);
  if (!name) {
    throw new Error(
      "That .apkg has no collection file inside. Is it really an Anki export?",
    );
  }

  let bytes: Uint8Array = files[name];
  if (name.endsWith("b")) {
    try {
      bytes = zstdDecompress(bytes) as Uint8Array;
    } catch {
      throw new Error(
        "Could not decompress the collection. Re-export from Anki with " +
          '"Support older Anki versions" enabled and try again.',
      );
    }
  }

  const tempPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "anki-import-")),
    "collection.sqlite",
  );

  try {
    fs.writeFileSync(tempPath, bytes);
    const source = new Database(tempPath, { readonly: true, fileMustExist: true });

    try {
      const deckNames = readDeckNames(source, warnings);
      const cardRows = source
        .prepare("select nid, did from cards")
        .all() as AnkiCardRow[];
      const noteRows = source
        .prepare("select id, mid, flds, tags from notes")
        .all() as AnkiNoteRow[];

      // A note can have several cards; its deck is the deck of its first card.
      const deckOfNote = new Map<number, number>();
      for (const card of cardRows) {
        if (!deckOfNote.has(card.nid)) deckOfNote.set(card.nid, card.did);
      }

      const byDeck = new Map<string, ParsedNote[]>();
      const collector = mediaCollector(files);
      let skipped = 0;

      for (const note of noteRows) {
        const fields = note.flds.split(FIELD_SEPARATOR);
        const cleaned = fields.map((field) => stripAnkiHtml(field));

        const [front, back, ...rest] = cleaned;
        if (!front || !back) {
          skipped += 1;
          continue;
        }

        // The first two fields are the question and the answer; everything
        // after them is folded into the note. Media follows its own field.
        const media: NoteMediaRef[] = [
          ...collector.take(front.media, "front"),
          ...collector.take(back.media, "back"),
          ...collector.take(rest.flatMap((field) => field.media), "extra"),
        ];

        const hasSide = (side: (typeof cleaned)[number], field: string) =>
          Boolean(side.text.trim()) || media.some((ref) => ref.field === field);

        // A picture-only or audio-only side is a real card, not an empty one.
        if (!hasSide(front, "front") || !hasSide(back, "back")) {
          skipped += 1;
          continue;
        }

        const deckId = deckOfNote.get(note.id);
        const deckName =
          (deckId !== undefined ? deckNames.get(deckId) : undefined) ?? "Default";

        const bucket = byDeck.get(deckName) ?? [];
        bucket.push({
          front: front.text.trim(),
          back: back.text.trim(),
          extra: rest
            .map((field) => field.text)
            .filter(Boolean)
            .join("\n")
            .trim(),
          tags: normalizeTags(note.tags ?? ""),
          media,
        });
        byDeck.set(deckName, bucket);
      }

      if (collector.missing() > 0) {
        warnings.push(
          `${collector.missing()} media reference(s) point at files that are not in the package.`,
        );
      }
      if (collector.rejected() > 0) {
        warnings.push(
          `${collector.rejected()} attached file(s) were skipped - not a supported image or audio format.`,
        );
      }
      if (collector.files.size > 0) {
        warnings.push(
          `${collector.files.size} image/audio file(s) will be imported with these cards.`,
        );
      }
      if (skipped > 0) {
        warnings.push(
          `${skipped} note(s) skipped: fewer than two non-empty fields.`,
        );
      }

      const decks: ParsedDeck[] = [...byDeck.entries()]
        .map(([deckName, notes]) => ({ name: deckName, notes }))
        .sort((a, b) => b.notes.length - a.notes.length);

      return {
        source: "apkg",
        decks,
        warnings,
        media: [...collector.files.values()],
      };
    } finally {
      source.close();
    }
  } finally {
    fs.rmSync(path.dirname(tempPath), { recursive: true, force: true });
  }
}


interface MediaCollector {
  /** Every distinct file pulled out so far, keyed by content hash. */
  readonly files: Map<string, ParsedMediaFile>;
  /** Turns the filenames one field referenced into note attachments. */
  take(filenames: string[], field: MediaField): NoteMediaRef[];
  /** Referenced by a note but absent from the package. */
  missing(): number;
  /** Present, but not an image or audio format we can serve. */
  rejected(): number;
}

/**
 * Resolves the filenames a field referenced to files inside the archive,
 * deduplicating by content so a pronunciation clip shared by fifty notes is
 * read, hashed and carried once.
 */
function mediaCollector(archive: Record<string, Uint8Array>): MediaCollector {
  const manifest = readMediaManifest(archive);
  const files = new Map<string, ParsedMediaFile>();
  /** Anki filename to hash, or null once we know it cannot be resolved. */
  const resolved = new Map<string, string | null>();
  let missing = 0;
  let rejected = 0;

  function load(filename: string): string | null {
    const entry = manifest.get(filename);
    const data = entry === undefined ? null : readMediaFile(archive, entry);
    if (!data) {
      missing += 1;
      return null;
    }

    const mime = resolveMime(filename, data);
    if (!mime) {
      rejected += 1;
      return null;
    }

    const hash = sha256(data);
    if (!files.has(hash)) {
      files.set(hash, { hash, filename, mime, size: data.length, data });
    }
    return hash;
  }

  function hashOf(filename: string): string | null {
    const cached = resolved.get(filename);
    if (cached !== undefined) return cached;

    const hash = load(filename);
    resolved.set(filename, hash);
    return hash;
  }

  return {
    files,
    take(filenames, field) {
      const refs: NoteMediaRef[] = [];
      for (const filename of filenames) {
        const hash = hashOf(filename);
        if (hash) refs.push({ field, hash });
      }
      return refs;
    },
    missing: () => missing,
    rejected: () => rejected,
  };
}

/**
 * Deck names live in `col.decks` (a JSON blob) up to schema 11, and in a real
 * `decks` table from schema 18 onwards.
 */
function readDeckNames(
  source: Database.Database,
  warnings: string[],
): Map<number, string> {
  const names = new Map<number, string>();

  const hasDecksTable = source
    .prepare(
      "select 1 from sqlite_master where type = 'table' and name = 'decks'",
    )
    .get();

  if (hasDecksTable) {
    const rows = source.prepare("select id, name from decks").all() as {
      id: number;
      name: string;
    }[];
    for (const row of rows) {
      // Schema 18 stores hierarchy with 0x1f between components.
      names.set(row.id, row.name.split(FIELD_SEPARATOR).join("::"));
    }
    return names;
  }

  try {
    const col = source.prepare("select decks from col limit 1").get() as
      | { decks: string }
      | undefined;
    if (col?.decks) {
      const parsed = JSON.parse(col.decks) as Record<string, { name?: string }>;
      for (const [id, deck] of Object.entries(parsed)) {
        if (deck?.name) names.set(Number(id), deck.name);
      }
    }
  } catch {
    warnings.push("Deck names could not be read - everything lands in one deck.");
  }

  return names;
}

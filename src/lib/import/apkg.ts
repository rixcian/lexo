import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { unzipSync } from "fflate";
import { decompress as zstdDecompress } from "fzstd";
import { normalizeTags, stripAnkiHtml } from "./text";
import type { ParsedDeck, ParsedNote, ParseResult } from "./types";

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
 * Not imported: media files, note templates, and the original scheduling
 * history - every imported card starts as New under this app's FSRS scheduler.
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
      let droppedMedia = 0;
      let skipped = 0;

      for (const note of noteRows) {
        const fields = note.flds.split(FIELD_SEPARATOR);
        const cleaned = fields.map((field) => {
          const result = stripAnkiHtml(field);
          droppedMedia += result.media;
          return result.text;
        });

        const [front, back, ...rest] = cleaned;
        if (!front?.trim() || !back?.trim()) {
          skipped += 1;
          continue;
        }

        const deckId = deckOfNote.get(note.id);
        const deckName =
          (deckId !== undefined ? deckNames.get(deckId) : undefined) ?? "Default";

        const bucket = byDeck.get(deckName) ?? [];
        bucket.push({
          front: front.trim(),
          back: back.trim(),
          extra: rest.filter(Boolean).join("\n").trim(),
          tags: normalizeTags(note.tags ?? ""),
        });
        byDeck.set(deckName, bucket);
      }

      if (droppedMedia > 0) {
        warnings.push(
          `${droppedMedia} image/audio reference(s) were removed - media is not imported.`,
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

      return { source: "apkg", decks, warnings };
    } finally {
      source.close();
    }
  } finally {
    fs.rmSync(path.dirname(tempPath), { recursive: true, force: true });
  }
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

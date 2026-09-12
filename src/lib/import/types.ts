import type { MediaField } from "@/lib/media/types";

/** One media file referenced by a note field, by content hash. */
export interface NoteMediaRef {
  field: MediaField;
  hash: string;
}

export interface ParsedNote {
  front: string;
  back: string;
  extra: string;
  tags: string[];
  media: NoteMediaRef[];
}

export interface ParsedDeck {
  name: string;
  notes: ParsedNote[];
}

/**
 * A media file pulled out of an import. `data` only exists between parsing and
 * staging - once staged, the bytes live on disk under `hash` and the metadata
 * travels alone through the (JSON) staging file.
 */
export interface ParsedMediaFile {
  hash: string;
  filename: string;
  mime: string;
  size: number;
  data?: Uint8Array;
}

export interface ParseResult {
  source: "csv" | "apkg" | "json";
  decks: ParsedDeck[];
  warnings: string[];
  /** Every file the parsed notes reference, deduplicated by hash. */
  media: ParsedMediaFile[];
}

export interface ImportSummary {
  deckId: number;
  deckName: string;
  created: number;
  duplicates: number;
  cardsCreated: number;
  /** Image / audio files attached to the notes of this deck. */
  mediaAttached: number;
}

import type { Delimiter } from "./csv";
import type { ImportSummary, ParsedNote } from "./types";

export interface DeckPreview {
  name: string;
  total: number;
  sample: ParsedNote[];
}

export interface ColumnMap {
  front: number;
  back: number;
  extra: number;
  tags: number;
}

export interface ImportPreview {
  token: string;
  kind: "csv" | "apkg";
  filename: string;
  warnings: string[];
  totalNotes: number;
  decks: DeckPreview[];
  csv?: {
    delimiter: Delimiter;
    hasHeader: boolean;
    header: string[];
    columns: ColumnMap;
    columnCount: number;
    sampleRows: string[][];
  };
}

export type ImportPreviewResult =
  | { ok: true; preview: ImportPreview }
  | { ok: false; error: string };

export type ImportConfirmResult =
  | { ok: true; summaries: ImportSummary[] }
  | { ok: false; error: string };

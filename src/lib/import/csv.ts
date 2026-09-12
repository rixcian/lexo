import type { ParsedNote, ParseResult } from "./types";
import { normalizeTags } from "./text";

export type Delimiter = "," | ";" | "\t" | "|";

export interface CsvOptions {
  delimiter?: Delimiter | "auto";
  /** Treat the first row as column names. */
  hasHeader?: boolean;
  /** Zero-based column indexes. -1 means "not present". */
  columns?: { front: number; back: number; extra: number; tags: number };
  deckName?: string;
}

const DELIMITERS: Delimiter[] = [",", ";", "\t", "|"];

/** Picks the delimiter that yields the most consistent column count. */
export function detectDelimiter(text: string): Delimiter {
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  if (sample.length === 0) return ",";

  let best: Delimiter = ",";
  let bestScore = -1;

  for (const delimiter of DELIMITERS) {
    const counts = sample.map((line) => splitRow(line, delimiter).length);
    const mode = counts.reduce<Record<number, number>>((acc, n) => {
      acc[n] = (acc[n] ?? 0) + 1;
      return acc;
    }, {});
    const [columns, hits] = Object.entries(mode).sort((a, b) => b[1] - a[1])[0];
    const score = Number(columns) > 1 ? hits * Number(columns) : 0;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

/** RFC-4180-ish row splitter: honours quotes and doubled escape quotes. */
function splitRow(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      out.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  out.push(field);
  return out;
}

/** Splits into rows, keeping newlines that sit inside a quoted field. */
export function splitRows(text: string): string[] {
  const rows: string[] = [];
  let current = "";
  let quoted = false;

  const normalized = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (char === '"') {
      if (quoted && normalized[i + 1] === '"') {
        // Escaped quote inside a quoted field - keep both, stay quoted.
        current += '""';
        i += 1;
        continue;
      }
      quoted = !quoted;
      current += char;
      continue;
    }
    if (char === "\n" && !quoted) {
      rows.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) rows.push(current);
  return rows;
}

const HEADER_ALIASES: Record<keyof NonNullable<CsvOptions["columns"]>, string[]> = {
  front: ["front", "term", "word", "question", "spanish", "source", "q", "a-side"],
  back: ["back", "definition", "translation", "answer", "english", "target", "a", "b-side"],
  extra: ["extra", "example", "notes", "note", "sentence", "hint", "comment"],
  tags: ["tags", "tag", "category", "categories", "labels"],
};

function guessColumns(header: string[]) {
  const lower = header.map((h) => h.trim().toLowerCase());
  const find = (key: keyof typeof HEADER_ALIASES) =>
    lower.findIndex((h) => HEADER_ALIASES[key].includes(h));

  return {
    front: find("front") >= 0 ? find("front") : 0,
    back: find("back") >= 0 ? find("back") : 1,
    extra: find("extra"),
    tags: find("tags"),
  };
}

/** Heuristic: a first row is a header when it matches known column names. */
export function looksLikeHeader(cells: string[]): boolean {
  const lower = cells.map((c) => c.trim().toLowerCase());
  const known = new Set(Object.values(HEADER_ALIASES).flat());
  return lower.filter((c) => known.has(c)).length >= 2;
}

export function previewCsv(text: string, options: CsvOptions = {}) {
  const delimiter =
    options.delimiter && options.delimiter !== "auto"
      ? options.delimiter
      : detectDelimiter(text);

  const rows = splitRows(text)
    // Anki's own text export prefixes metadata lines with '#'.
    .filter((row) => row.trim() && !row.startsWith("#"))
    .map((row) => splitRow(row, delimiter));

  const hasHeader = options.hasHeader ?? (rows[0] ? looksLikeHeader(rows[0]) : false);
  const header = hasHeader ? rows[0].map((c) => c.trim()) : [];
  const body = hasHeader ? rows.slice(1) : rows;
  const columns = options.columns ?? (hasHeader ? guessColumns(header) : { front: 0, back: 1, extra: -1, tags: -1 });

  return { delimiter, hasHeader, header, body, columns };
}

export function parseCsv(text: string, options: CsvOptions = {}): ParseResult {
  const { body, columns } = previewCsv(text, options);
  const warnings: string[] = [];
  const parsed: ParsedNote[] = [];

  let skipped = 0;
  for (const cells of body) {
    const pick = (index: number) => (index >= 0 ? (cells[index] ?? "").trim() : "");
    const front = pick(columns.front);
    const back = pick(columns.back);

    if (!front || !back) {
      skipped += 1;
      continue;
    }

    parsed.push({
      front,
      back,
      extra: pick(columns.extra),
      tags: normalizeTags(pick(columns.tags)),
    });
  }

  if (skipped > 0) {
    warnings.push(`${skipped} row(s) skipped: front or back was empty.`);
  }

  return {
    source: "csv",
    decks: [{ name: options.deckName?.trim() || "Imported deck", notes: parsed }],
    warnings,
  };
}

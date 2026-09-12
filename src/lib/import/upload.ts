import "server-only";

import { parseApkg } from "./apkg";
import { parseCsv, previewCsv, type CsvOptions } from "./csv";
import { tooLargeMessage } from "./limits";
import type {
  DeckPreview,
  ImportPreview,
  ImportPreviewResult,
} from "./preview-types";
import { stage } from "./staging";
import type { ParseResult } from "./types";

function toDeckPreviews(result: ParseResult): DeckPreview[] {
  return result.decks.map((deck) => ({
    name: deck.name,
    total: deck.notes.length,
    sample: deck.notes.slice(0, 5),
  }));
}

export function buildCsvPreview(
  token: string,
  filename: string,
  text: string,
  options: CsvOptions,
): ImportPreview {
  const meta = previewCsv(text, options);
  const parsed = parseCsv(text, { ...options, deckName: options.deckName });

  return {
    token,
    kind: "csv",
    filename,
    warnings: parsed.warnings,
    totalNotes: parsed.decks[0]?.notes.length ?? 0,
    decks: toDeckPreviews(parsed),
    csv: {
      delimiter: meta.delimiter,
      hasHeader: meta.hasHeader,
      header: meta.header,
      columns: meta.columns,
      columnCount: Math.max(
        meta.header.length,
        ...meta.body.slice(0, 20).map((row) => row.length),
        2,
      ),
      sampleRows: meta.body.slice(0, 5),
    },
  };
}

/**
 * Parses an uploaded deck file and stages it for confirmation. Shared by the
 * upload route and anything else that ends up holding a `File`.
 */
export async function parseImportUpload(
  file: FormDataEntryValue | null,
  limitBytes: number,
): Promise<ImportPreviewResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a file first." };
  }
  // The Content-Length check upstream can be missing or lie; this one cannot.
  if (file.size > limitBytes) {
    return { ok: false, error: tooLargeMessage() };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  const isApkg =
    name.endsWith(".apkg") ||
    name.endsWith(".colpkg") ||
    // Every zip starts with "PK\x03\x04".
    (buffer[0] === 0x50 && buffer[1] === 0x4b);

  try {
    if (isApkg) {
      const result = parseApkg(buffer);
      const token = stage({ kind: "apkg", filename: file.name, result });
      return {
        ok: true,
        preview: {
          token,
          kind: "apkg",
          filename: file.name,
          warnings: result.warnings,
          totalNotes: result.decks.reduce((n, d) => n + d.notes.length, 0),
          decks: toDeckPreviews(result),
          mediaFiles: result.media.length,
          mediaBytes: result.media.reduce((n, media) => n + media.size, 0),
        },
      };
    }

    const text = buffer.toString("utf8").replace(/^\ufeff/, "");
    const token = stage({ kind: "csv", filename: file.name, text });
    return {
      ok: true,
      preview: buildCsvPreview(token, file.name, text, {
        deckName: file.name.replace(/\.[^.]+$/, ""),
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not read that file.",
    };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { parseApkg } from "./apkg";
import { parseCsv, previewCsv, type CsvOptions } from "./csv";
import { ingest, type IngestOptions } from "./ingest";
import type {
  DeckPreview,
  ImportConfirmResult,
  ImportPreview,
  ImportPreviewResult,
} from "./preview-types";
import { discard, read, stage } from "./staging";
import type { ParseResult } from "./types";

const MAX_BYTES = 64 * 1024 * 1024;

function toDeckPreviews(result: ParseResult): DeckPreview[] {
  return result.decks.map((deck) => ({
    name: deck.name,
    total: deck.notes.length,
    sample: deck.notes.slice(0, 5),
  }));
}

function buildCsvPreview(
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

export async function uploadImportAction(
  formData: FormData,
): Promise<ImportPreviewResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a file first." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "That file is larger than 64 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isApkg =
    file.name.toLowerCase().endsWith(".apkg") ||
    file.name.toLowerCase().endsWith(".colpkg") ||
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

/** Re-parses a staged CSV after the user adjusts delimiter / header / columns. */
export async function previewImportAction(
  token: string,
  options: CsvOptions,
): Promise<ImportPreviewResult> {
  try {
    const staged = read(token);
    if (staged.kind !== "csv") {
      return { ok: false, error: "Only CSV uploads can be remapped." };
    }
    return {
      ok: true,
      preview: buildCsvPreview(token, staged.filename, staged.text, options),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Preview failed.",
    };
  }
}

export async function confirmImportAction(
  token: string,
  options: IngestOptions & { csv?: CsvOptions },
): Promise<ImportConfirmResult> {
  try {
    const staged = read(token);
    const result =
      staged.kind === "csv"
        ? parseCsv(staged.text, options.csv ?? {})
        : staged.result;

    const summaries = ingest(result, options);
    discard(token);

    revalidatePath("/");
    revalidatePath("/stats");
    for (const summary of summaries) revalidatePath(`/decks/${summary.deckId}`);

    return { ok: true, summaries };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Import failed.",
    };
  }
}

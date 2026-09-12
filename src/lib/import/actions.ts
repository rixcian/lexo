"use server";

import fs from "node:fs";
import { revalidatePath } from "next/cache";
import { parseCsv, type CsvOptions } from "./csv";
import { ingest, type IngestOptions, type MediaLoader } from "./ingest";
import { buildCsvPreview } from "./upload";
import type { ImportConfirmResult, ImportPreviewResult } from "./preview-types";
import { discard, read, stagedMediaPath } from "./staging";

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

    // Media waits in the staging directory until the user commits to the
    // import, so a preview the user walks away from leaves nothing behind.
    const loadMedia: MediaLoader =
      staged.kind === "apkg"
        ? (file) => {
            try {
              return fs.readFileSync(stagedMediaPath(token, file.hash));
            } catch {
              return null;
            }
          }
        : () => null;

    const summaries = ingest(result, options, loadMedia);
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

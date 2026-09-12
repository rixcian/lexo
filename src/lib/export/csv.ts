import type { DeckExport } from "./deck";
import { MEDIA_FIELDS } from "@/lib/media/types";

/** RFC-4180: quote when the value could otherwise break the row. */
function cell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const CSV_HEADER = ["front", "back", "extra", "tags"] as const;

/**
 * Writes the deck as the same four-column CSV the importer reads, so a file
 * exported here comes back in unchanged.
 *
 * CSV has nowhere to put a picture or a clip. Rather than drop them silently,
 * attachments are listed by filename in the `extra` column and the caller is
 * told how many notes that affected.
 */
export function toCsv(data: DeckExport): { text: string; notesWithMedia: number } {
  const rows: string[] = [CSV_HEADER.join(",")];
  let notesWithMedia = 0;

  const names = (field: (typeof MEDIA_FIELDS)[number], note: DeckExport["notes"][number]) =>
    note.media[field].map((file) => file.filename);

  for (const note of data.notes) {
    const attachments = MEDIA_FIELDS.flatMap((field) => names(field, note));
    if (attachments.length > 0) notesWithMedia += 1;

    // A picture-only side has no text to write. Naming its files there keeps
    // the row importable instead of quietly dropping the card, and says what
    // is missing; sides that do have text are left clean.
    const side = (field: "front" | "back", text: string) =>
      text || (names(field, note).length > 0 ? `[${names(field, note).join(", ")}]` : "");

    const extra = [note.extra, attachments.length > 0 ? `[${attachments.join(", ")}]` : ""]
      .filter(Boolean)
      .join(" ");

    rows.push(
      [side("front", note.front), side("back", note.back), extra, note.tags.join(" ")]
        .map(cell)
        .join(","),
    );
  }

  // A trailing newline - some tools treat a missing one as a truncated file.
  return { text: `${rows.join("\n")}\n`, notesWithMedia };
}

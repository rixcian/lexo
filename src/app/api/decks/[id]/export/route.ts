import { toApkg } from "@/lib/export/apkg";
import { toCsv } from "@/lib/export/csv";
import { exportFilename, readDeckForExport } from "@/lib/export/deck";

export const dynamic = "force-dynamic";

/**
 * Downloads one deck. A route handler rather than a server action because the
 * browser has to receive this as a file, and an action can only hand back a
 * value the page then has to turn into a download itself.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deckId = Number(id);
  if (!Number.isInteger(deckId)) {
    return new Response("Not found", { status: 404 });
  }

  const data = readDeckForExport(deckId);
  if (!data) return new Response("Not found", { status: 404 });

  const format = new URL(request.url).searchParams.get("format") ?? "apkg";

  if (format === "csv") {
    const { text } = toCsv(data);
    return download(
      new TextEncoder().encode(text),
      exportFilename(data.deck.name, "csv"),
      "text/csv; charset=utf-8",
    );
  }

  if (format !== "apkg") {
    return new Response("Unknown format - use apkg or csv", { status: 400 });
  }

  const { bytes } = toApkg(data);
  return download(
    bytes,
    exportFilename(data.deck.name, "apkg"),
    "application/octet-stream",
  );
}

function download(body: Uint8Array, filename: string, type: string) {
  // Re-wrapped because a Buffer (and fflate's output) is typed over
  // ArrayBufferLike, which a Blob part will not accept.
  const bytes = new Uint8Array(body);

  return new Response(new Blob([bytes], { type }), {
    headers: {
      "Content-Type": type,
      // The filename is already slugged to ASCII, so it needs no encoding
      // games - and a deck name can never break out of the header.
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      // A deck changes as you study it; never hand back a stale copy.
      "Cache-Control": "no-store",
    },
  });
}

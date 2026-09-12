import fs from "node:fs";
import { getMediaByHash, filePath } from "@/lib/media/store";

export const dynamic = "force-dynamic";

/** URLs look like `/api/media/<sha256>.mp3`; only the hash is authoritative. */
const NAME = /^([a-f0-9]{64})(?:\.[a-z0-9]+)?$/;

/**
 * Media files are immutable - the name *is* the hash of the contents - so they
 * are cached hard and forever. Range requests are answered because Safari will
 * not play an `<audio>` source that cannot serve them.
 */
function baseHeaders(mime: string, size: number) {
  return {
    "Content-Type": mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    // Uploaded SVGs are scriptable; this keeps one from running if a user
    // opens the raw URL in a tab. Rendering through <img> is unaffected.
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "Content-Length": String(size),
  };
}

/** Parses a single-range `bytes=a-b` header. Multi-range is not worth it here. */
function parseRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;

  // "bytes=-500" means the last 500 bytes.
  const start = rawStart === "" ? Math.max(0, size - Number(rawEnd)) : Number(rawStart);
  const end = rawStart === "" || rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end || start >= size) return null;
  return { start, end };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const match = NAME.exec(name);
  if (!match) return new Response("Not found", { status: 404 });

  const row = getMediaByHash(match[1]);
  if (!row) return new Response("Not found", { status: 404 });

  const file = filePath(row.hash);
  let size: number;
  try {
    size = fs.statSync(file).size;
  } catch {
    // The row outlived its file - a half-restored backup, say.
    return new Response("Not found", { status: 404 });
  }

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const range = parseRange(rangeHeader, size);
    if (!range) {
      return new Response("Range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const length = range.end - range.start + 1;
    return new Response(fs.readFileSync(file).subarray(range.start, range.end + 1), {
      status: 206,
      headers: {
        ...baseHeaders(row.mime, length),
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      },
    });
  }

  return new Response(fs.readFileSync(file), {
    headers: baseHeaders(row.mime, size),
  });
}

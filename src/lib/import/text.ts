const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

export interface StripResult {
  text: string;
  /** Media filenames the field referenced, in the order they appeared. */
  media: string[];
}

/** `src="a.jpg"`, `src='a.jpg'` and bare `src=a.jpg` all occur in the wild. */
const IMG_SOURCE = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

/**
 * Anki stores media under a plain filename, but the field may have it escaped
 * as HTML and percent-encoded on top.
 */
function normalizeMediaName(raw: string): string {
  const decoded = decodeEntities(raw).trim();
  try {
    return decodeURIComponent(decoded);
  } catch {
    // A stray % that is not an escape - the raw name is the best guess.
    return decoded;
  }
}

/**
 * Anki fields are HTML. We keep the text and the line structure, drop the
 * markup, and collect the media filenames so the importer can pull those files
 * out of the package and attach them to the note.
 */
export function stripAnkiHtml(input: string): StripResult {
  const media: string[] = [];
  const remember = (name: string) => {
    const clean = normalizeMediaName(name);
    if (clean && !media.includes(clean)) media.push(clean);
  };

  let out = input.replace(/\[sound:([^\]]*)\]/gi, (_match, name: string) => {
    remember(name);
    return "";
  });

  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    const source = IMG_SOURCE.exec(tag);
    if (source) remember(source[1] ?? source[2] ?? source[3] ?? "");
    return "";
  });

  out = out
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|tr|h[1-6])>/gi, "\n")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "");

  out = decodeEntities(out)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: out, media };
}

export function normalizeTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );
}

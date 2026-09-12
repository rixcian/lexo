/**
 * Shared media vocabulary. No `server-only` here - the study session and the
 * card forms are client components and need the same mime tables.
 */

export type MediaKind = "image" | "audio";

/** The three note fields a file can hang off. */
export const MEDIA_FIELDS = ["front", "back", "extra"] as const;
export type MediaField = (typeof MEDIA_FIELDS)[number];

export function isMediaField(value: string): value is MediaField {
  return (MEDIA_FIELDS as readonly string[]).includes(value);
}

/**
 * Extension to mime. Anki writes real extensions into its media manifest, so
 * this is the primary lookup; `sniffMime` only covers the odd nameless file.
 */
const BY_EXTENSION: Record<string, string> = {
  // Images
  apng: "image/apng",
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/x-icon",
  jpe: "image/jpeg",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
  // Audio
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  mpga: "audio/mpeg",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  weba: "audio/webm",
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/apng": "apng",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/tiff": "tiff",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "weba",
};

export function extensionOf(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return match ? match[1].toLowerCase() : "";
}

export function mimeFromFilename(filename: string): string | null {
  return BY_EXTENSION[extensionOf(filename)] ?? null;
}

/** Falls back to a mime the browser can actually play or paint. */
export function mediaKind(mime: string): MediaKind | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

/**
 * URLs are content-addressed and carry a real extension, so the service worker
 * can treat them as immutable static assets.
 */
export function mediaUrl(hash: string, mime: string): string {
  const extension = EXTENSION_BY_MIME[mime] ?? "bin";
  return `/api/media/${hash}.${extension}`;
}

/** What the UI receives for one attachment. */
export interface AttachedMedia {
  /**
   * The `note_media` row id - this file *on this note*. Detaching addresses
   * this, never `mediaId`: the file itself is shared between notes.
   */
  attachmentId: number;
  /** The `media` row id - the shared, content-addressed file. */
  mediaId: number;
  hash: string;
  filename: string;
  mime: string;
  kind: MediaKind;
  url: string;
}

/** Attachments of one note, already split by field. */
export type NoteMediaMap = Record<MediaField, AttachedMedia[]>;

export function emptyMediaMap(): NoteMediaMap {
  return { front: [], back: [], extra: [] };
}

export function hasMedia(map: NoteMediaMap | undefined): boolean {
  if (!map) return false;
  return MEDIA_FIELDS.some((field) => map[field].length > 0);
}

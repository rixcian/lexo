/**
 * How large a deck file the import route accepts.
 *
 * Read on every call rather than at module load, so the value tracks the
 * environment the container was started with and needs no rebuild. The deck
 * upload is a route handler for exactly this reason: `serverActions
 * .bodySizeLimit` is serialized into the standalone build and cannot be moved
 * afterwards, while a route handler has no such cap.
 */
export const DEFAULT_MAX_UPLOAD_MB = 100;

/** Above this the process would be buffering more than it can chew. */
const CEILING_MB = 2048;

export function maxUploadMb(): number {
  const raw = process.env.ANKI_MAX_UPLOAD_MB;
  if (!raw) return DEFAULT_MAX_UPLOAD_MB;

  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[import] ANKI_MAX_UPLOAD_MB is "${raw}", which is not a positive number - falling back to ${DEFAULT_MAX_UPLOAD_MB} MB`,
    );
    return DEFAULT_MAX_UPLOAD_MB;
  }

  return Math.min(Math.floor(parsed), CEILING_MB);
}

export function maxUploadBytes(): number {
  return maxUploadMb() * 1024 * 1024;
}

export function tooLargeMessage(limitMb = maxUploadMb()): string {
  return `That file is larger than ${limitMb} MB. Raise ANKI_MAX_UPLOAD_MB if you need more.`;
}

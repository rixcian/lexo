import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db, DB_PATH } from "@/db";
import { media, noteMedia, type Media } from "@/db/schema";
import {
  emptyMediaMap,
  isMediaField,
  mediaKind,
  mediaUrl,
  mimeFromFilename,
  type AttachedMedia,
  type MediaField,
  type NoteMediaMap,
} from "./types";

/** Sits next to the database so one bind mount covers the whole collection. */
export const MEDIA_DIR =
  process.env.ANKI_MEDIA_DIR ?? path.join(path.dirname(DB_PATH), "media");

/** Refuses anything larger - a flashcard does not need a 25 MB clip. */
export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

export function sha256(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * Two hex characters of the hash become a directory, so a big collection does
 * not put a hundred thousand entries in one folder.
 */
export function filePath(hash: string): string {
  return path.join(MEDIA_DIR, hash.slice(0, 2), hash);
}

/** Magic-byte fallback for files whose name says nothing useful. */
export function sniffMime(bytes: Uint8Array): string | null {
  const starts = (...signature: number[]) =>
    signature.every((byte, i) => bytes[i] === byte);
  const ascii = (offset: number, text: string) =>
    [...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0));

  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (ascii(0, "GIF8")) return "image/gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(0, "RIFF") && ascii(8, "WAVE")) return "audio/wav";
  if (ascii(4, "ftyp")) {
    // Both .m4a audio and .mp4 video use this box; we only accept the audio one.
    return ascii(8, "M4A") || ascii(8, "mp42") || ascii(8, "isom")
      ? "audio/mp4"
      : null;
  }
  if (ascii(0, "OggS")) return "audio/ogg";
  if (ascii(0, "fLaC")) return "audio/flac";
  if (ascii(0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
    return "audio/mpeg";
  }
  if (ascii(0, "<?xml") || ascii(0, "<svg")) return "image/svg+xml";
  return null;
}

/**
 * Resolves the mime of an incoming file, preferring the declared one when the
 * browser sent something sensible. Returns null for anything that is neither
 * an image nor audio - those are dropped rather than stored.
 */
export function resolveMime(
  filename: string,
  bytes: Uint8Array,
  declared?: string,
): string | null {
  const candidates = [
    declared && declared !== "application/octet-stream" ? declared : null,
    mimeFromFilename(filename),
    sniffMime(bytes),
  ];
  for (const candidate of candidates) {
    if (candidate && mediaKind(candidate)) return candidate;
  }
  return null;
}

export interface StoreInput {
  filename: string;
  bytes: Uint8Array;
  /** Mime from the upload, when the client sent a believable one. */
  declaredMime?: string;
}

/**
 * Writes a file into the content-addressed store and returns its row. Files
 * already present (same sha256) are reused, so re-importing a deck costs
 * nothing on disk.
 */
export function storeMedia(input: StoreInput): Media | null {
  const { bytes, filename } = input;
  if (bytes.length === 0 || bytes.length > MAX_MEDIA_BYTES) return null;

  const mime = resolveMime(filename, bytes, input.declaredMime);
  if (!mime) return null;

  const hash = sha256(bytes);
  const existing = db.select().from(media).where(eq(media.hash, hash)).get();

  const destination = filePath(hash);
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    // Write beside the target and rename, so a crash never leaves a half file
    // under a name that claims to be its own hash.
    const temporary = `${destination}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, bytes);
    fs.renameSync(temporary, destination);
  }

  if (existing) return existing;

  return db
    .insert(media)
    .values({
      hash,
      filename: path.basename(filename).slice(0, 255) || hash,
      mime,
      bytes: bytes.length,
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

export function getMediaByHash(hash: string): Media | undefined {
  return db.select().from(media).where(eq(media.hash, hash)).get();
}

export function toAttached(attachmentId: number, row: Media): AttachedMedia {
  return {
    attachmentId,
    mediaId: row.id,
    hash: row.hash,
    filename: row.filename,
    mime: row.mime,
    // A row only exists when resolveMime accepted it, so the kind is never null.
    kind: mediaKind(row.mime) ?? "image",
    url: mediaUrl(row.hash, row.mime),
  };
}

/** Every attachment of one note, grouped by field and in insertion order. */
export function noteMediaMap(noteId: number): NoteMediaMap {
  return noteMediaMaps([noteId])[noteId] ?? emptyMediaMap();
}

/** The same, batched - one query for a whole page of browse rows or a queue. */
export function noteMediaMaps(
  noteIds: number[],
): Record<number, NoteMediaMap> {
  const out: Record<number, NoteMediaMap> = {};
  if (noteIds.length === 0) return out;

  const rows = db
    .select({
      attachmentId: noteMedia.id,
      noteId: noteMedia.noteId,
      field: noteMedia.field,
      media,
    })
    .from(noteMedia)
    .innerJoin(media, eq(noteMedia.mediaId, media.id))
    .where(inArray(noteMedia.noteId, noteIds))
    .orderBy(noteMedia.noteId, noteMedia.position, noteMedia.id)
    .all();

  for (const row of rows) {
    if (!isMediaField(row.field)) continue;
    const map = (out[row.noteId] ??= emptyMediaMap());
    map[row.field].push(toAttached(row.attachmentId, row.media));
  }
  return out;
}

/** Appends files to a field, continuing after whatever is already there. */
export function attachMedia(
  noteId: number,
  field: MediaField,
  mediaIds: number[],
) {
  if (mediaIds.length === 0) return;

  const last =
    db
      .select({ position: sql<number>`coalesce(max(${noteMedia.position}), -1)` })
      .from(noteMedia)
      .where(eq(noteMedia.noteId, noteId))
      .get()?.position ?? -1;

  db.insert(noteMedia)
    .values(
      mediaIds.map((mediaId, index) => ({
        noteId,
        mediaId,
        field,
        position: last + 1 + index,
      })),
    )
    .run();
}

export function detachMedia(noteId: number, noteMediaIds: number[]) {
  if (noteMediaIds.length === 0) return;
  db.delete(noteMedia)
    .where(and(eq(noteMedia.noteId, noteId), inArray(noteMedia.id, noteMediaIds)))
    .run();
}

/**
 * Drops rows - and files - no note points at any more. Deleting a note cascades
 * its `note_media` rows but leaves the shared file behind, so callers that
 * remove notes or decks finish with this.
 */
export function pruneOrphanMedia(): number {
  const orphans = db
    .select({ id: media.id, hash: media.hash })
    .from(media)
    .where(
      notInArray(
        media.id,
        db.select({ id: noteMedia.mediaId }).from(noteMedia),
      ),
    )
    .all();

  if (orphans.length === 0) return 0;

  db.delete(media)
    .where(
      inArray(
        media.id,
        orphans.map((row) => row.id),
      ),
    )
    .run();

  for (const orphan of orphans) {
    try {
      fs.rmSync(filePath(orphan.hash), { force: true });
    } catch {
      // A stale file costs disk, not correctness - never fail a delete over it.
    }
  }
  return orphans.length;
}

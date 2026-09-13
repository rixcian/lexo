"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, sqlite } from "@/db";
import { cards, decks, notes, reviews } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { userIds } from "@/lib/auth/users";
import { fingerprint } from "@/lib/fingerprint";
import {
  attachMedia,
  detachMedia,
  MAX_MEDIA_BYTES,
  noteMediaMap,
  pruneOrphanMedia,
  resolveMime,
  sha256,
  storeMedia,
} from "@/lib/media/store";
import { MEDIA_FIELDS, type MediaField } from "@/lib/media/types";
import {
  formatInterval,
  gradeCard,
  newCardState,
  type Grade,
} from "@/lib/scheduler";

const DECK_COLORS = [
  "brand",
  "macaw",
  "streak",
  "heart",
  "xp",
  "super",
] as const;

const deckInput = z.object({
  name: z.string().trim().min(1, "Give the deck a name").max(80),
  description: z.string().trim().max(400).default(""),
  frontLang: z.string().trim().max(40).default(""),
  backLang: z.string().trim().max(40).default(""),
  color: z.enum(DECK_COLORS).default("brand"),
  newPerDay: z.coerce.number().int().min(0).max(9999).default(20),
  reviewsPerDay: z.coerce.number().int().min(0).max(9999).default(200),
  reverseCards: z.coerce.boolean().default(false),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * A card id only means something together with its owner: the same note has one
 * card row per person, so an id from someone else's queue must read as missing
 * rather than as something to grade.
 */
function ownCard(userId: number, cardId: number) {
  return db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.userId, userId)))
    .get();
}

function formToObject(formData: FormData) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  // Unchecked checkboxes simply do not appear in the payload.
  out.reverseCards = formData.get("reverseCards") === "on" || formData.get("reverseCards") === "true";
  return out;
}

export async function createDeckAction(formData: FormData): Promise<void> {
  await requireUser();

  const parsed = deckInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid deck");
  }

  const row = db.insert(decks).values(parsed.data).returning({ id: decks.id }).get();
  revalidatePath("/");
  redirect(`/decks/${row.id}`);
}

export async function updateDeckAction(
  deckId: number,
  formData: FormData,
): Promise<void> {
  await requireUser();

  const parsed = deckInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid deck");
  }

  db.update(decks).set(parsed.data).where(eq(decks.id, deckId)).run();
  revalidatePath("/");
  revalidatePath(`/decks/${deckId}`);
}

export async function setDeckArchivedAction(deckId: number, archived: boolean) {
  await requireUser();

  db.update(decks).set({ archived }).where(eq(decks.id, deckId)).run();
  revalidatePath("/");
  revalidatePath(`/decks/${deckId}`);
}

export async function deleteDeckAction(deckId: number): Promise<void> {
  await requireUser();

  db.delete(decks).where(eq(decks.id, deckId)).run();
  // Its notes cascaded away, and with them the last claim on their media.
  pruneOrphanMedia();

  revalidatePath("/");
  redirect("/");
}

// A side may be wordless as long as it carries a picture or a clip, so the
// "not empty" rule is checked against the attachments rather than here.
const noteInput = z.object({
  front: z.string().trim().max(2000).default(""),
  back: z.string().trim().max(2000).default(""),
  extra: z.string().trim().max(4000).default(""),
  tags: z.string().trim().max(400).default(""),
});


/** One upload, already read off the wire and ready for the media store. */
interface PreparedUpload {
  field: MediaField;
  filename: string;
  mime: string;
  bytes: Uint8Array;
  hash: string;
}

/**
 * Reads the note form's file inputs. This happens before the database
 * transaction opens, because `sqlite.transaction` takes a synchronous callback
 * and pulling bytes out of a `File` is asynchronous.
 */
async function readUploads(
  formData: FormData,
): Promise<{ uploads: PreparedUpload[] } | { error: string }> {
  const uploads: PreparedUpload[] = [];

  for (const field of MEDIA_FIELDS) {
    const files = formData
      .getAll(`media:${field}`)
      .filter((value): value is File => value instanceof File && value.size > 0);

    for (const file of files) {
      if (file.size > MAX_MEDIA_BYTES) {
        const limit = Math.round(MAX_MEDIA_BYTES / 1024 / 1024);
        return { error: `${file.name} is larger than ${limit} MB.` };
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = resolveMime(file.name, bytes, file.type);
      if (!mime) {
        return { error: `${file.name} is not an image or an audio clip.` };
      }

      uploads.push({ field, filename: file.name, mime, bytes, hash: sha256(bytes) });
    }
  }

  return { uploads };
}

/** Writes prepared uploads into the store and hangs them off the note. */
function commitUploads(noteId: number, uploads: PreparedUpload[]) {
  for (const field of MEDIA_FIELDS) {
    const ids: number[] = [];
    for (const upload of uploads.filter((item) => item.field === field)) {
      const row = storeMedia({
        filename: upload.filename,
        bytes: upload.bytes,
        declaredMime: upload.mime,
      });
      if (row) ids.push(row.id);
    }
    attachMedia(noteId, field, ids);
  }
}

/**
 * `note_media` row ids the form asked to detach. These identify the file *on
 * this note*, not the shared `media` row - detaching by the latter would hit
 * whatever attachment happened to share that number.
 */
function detachedAttachmentIds(formData: FormData): number[] {
  const raw = formData.get("removeMedia");
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is number => Number.isInteger(id))
      : [];
  } catch {
    return [];
  }
}

/** Front and back media identify a note, the same way their text does. */
function identifyingHashes(uploads: PreparedUpload[], kept: string[] = []): string[] {
  return [
    ...kept,
    ...uploads.filter((item) => item.field !== "extra").map((item) => item.hash),
  ];
}

function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );
}

/**
 * Inserts a note plus its card(s). Runs in one transaction so a deck can never
 * hold a note with no scheduled card.
 */
export async function createNoteAction(
  deckId: number,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();

  const parsed = noteInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid note" };
  }

  const deck = db.select().from(decks).where(eq(decks.id, deckId)).get();
  if (!deck) return { ok: false, error: "Deck not found" };

  const read = await readUploads(formData);
  if ("error" in read) return { ok: false, error: read.error };
  const { uploads } = read;

  const { front, back, extra } = parsed.data;
  const has = (field: MediaField, text: string) =>
    Boolean(text) || uploads.some((item) => item.field === field);

  if (!has("front", front)) {
    return { ok: false, error: "The front needs text or an attachment" };
  }
  if (!has("back", back)) {
    return { ok: false, error: "The back needs text or an attachment" };
  }

  const fp = fingerprint(front, back, identifyingHashes(uploads));

  const existing = db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.deckId, deckId), eq(notes.fingerprint, fp)))
    .get();
  if (existing) {
    return { ok: false, error: "That card is already in this deck" };
  }

  const now = Date.now();
  const fresh = newCardState(new Date(now));

  sqlite.transaction(() => {
    const note = db
      .insert(notes)
      .values({
        deckId,
        front,
        back,
        extra,
        tags: JSON.stringify(parseTags(parsed.data.tags)),
        fingerprint: fp,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: notes.id })
      .get();

    // The deck is shared, so the note is too - everyone gets their own copy of
    // its schedule, starting from new.
    const templates = deck.reverseCards ? ["forward", "reverse"] : ["forward"];
    db.insert(cards)
      .values(
        userIds().flatMap((userId) =>
          templates.map((template) => ({
            userId,
            noteId: note.id,
            deckId,
            template,
            ...fresh,
          })),
        ),
      )
      .run();

    commitUploads(note.id, uploads);
  })();

  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updateNoteAction(
  noteId: number,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();

  const parsed = noteInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid note" };
  }

  const note = db.select().from(notes).where(eq(notes.id, noteId)).get();
  if (!note) return { ok: false, error: "Card not found" };

  const read = await readUploads(formData);
  if ("error" in read) return { ok: false, error: read.error };
  const { uploads } = read;

  const detaching = detachedAttachmentIds(formData);
  const current = noteMediaMap(noteId);
  const { front, back, extra } = parsed.data;

  const keeps = (field: MediaField) =>
    current[field].filter((file) => !detaching.includes(file.attachmentId));
  const has = (field: MediaField, text: string) =>
    Boolean(text) ||
    keeps(field).length > 0 ||
    uploads.some((item) => item.field === field);

  if (!has("front", front)) {
    return { ok: false, error: "The front needs text or an attachment" };
  }
  if (!has("back", back)) {
    return { ok: false, error: "The back needs text or an attachment" };
  }

  const kept = [...keeps("front"), ...keeps("back")].map((file) => file.hash);

  sqlite.transaction(() => {
    detachMedia(noteId, detaching);
    commitUploads(noteId, uploads);

    db.update(notes)
      .set({
        front,
        back,
        extra,
        tags: JSON.stringify(parseTags(parsed.data.tags)),
        fingerprint: fingerprint(front, back, identifyingHashes(uploads, kept)),
        updatedAt: Date.now(),
      })
      .where(eq(notes.id, noteId))
      .run();
  })();

  // A file the note just let go of may have been its last reference.
  if (detaching.length > 0) pruneOrphanMedia();

  revalidatePath(`/decks/${note.deckId}`);
  return { ok: true };
}

export async function deleteNoteAction(noteId: number): Promise<ActionResult> {
  await requireUser();

  const note = db.select().from(notes).where(eq(notes.id, noteId)).get();
  if (!note) return { ok: false, error: "Card not found" };

  db.delete(notes).where(eq(notes.id, noteId)).run();
  // The join rows cascaded away; the files they pointed at may now be unused.
  pruneOrphanMedia();

  revalidatePath(`/decks/${note.deckId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function setCardSuspendedAction(
  cardId: number,
  suspended: boolean,
): Promise<ActionResult> {
  const user = await requireUser();

  const card = ownCard(user.id, cardId);
  if (!card) return { ok: false, error: "Card not found" };

  db.update(cards).set({ suspended }).where(eq(cards.id, cardId)).run();
  revalidatePath(`/decks/${card.deckId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Wipes a card's scheduling history and sends it back to the New queue. */
export async function resetCardAction(cardId: number): Promise<ActionResult> {
  const user = await requireUser();

  const card = ownCard(user.id, cardId);
  if (!card) return { ok: false, error: "Card not found" };

  sqlite.transaction(() => {
    db.update(cards).set(newCardState()).where(eq(cards.id, cardId)).run();
    db.delete(reviews).where(eq(reviews.cardId, cardId)).run();
  })();

  revalidatePath(`/decks/${card.deckId}`);
  revalidatePath("/");
  return { ok: true };
}

export interface GradeResult {
  ok: boolean;
  error?: string;
  /** Unix ms the card is next due. */
  due?: number;
  state?: number;
  interval?: string;
  /** True when the card comes back inside this session (learning step). */
  requeue?: boolean;
}

/** Cards that come due within this window are replayed in the same session. */
const SAME_SESSION_WINDOW_MS = 20 * 60 * 1000;

export async function gradeCardAction(
  cardId: number,
  rating: number,
  durationMs = 0,
): Promise<GradeResult> {
  const user = await requireUser();

  if (![1, 2, 3, 4].includes(rating)) {
    return { ok: false, error: "Unknown rating" };
  }

  const card = ownCard(user.id, cardId);
  if (!card) return { ok: false, error: "Card not found" };

  const now = new Date();
  const { cardUpdate, reviewRow } = gradeCard(card, rating as Grade, now);

  sqlite.transaction(() => {
    db.update(cards).set(cardUpdate).where(eq(cards.id, cardId)).run();
    db.insert(reviews)
      .values({
        ...reviewRow,
        userId: user.id,
        durationMs: Math.max(0, Math.round(durationMs)),
      })
      .run();
  })();

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/decks/${card.deckId}`);

  return {
    ok: true,
    due: cardUpdate.due,
    state: cardUpdate.state,
    interval: formatInterval(cardUpdate.due - now.getTime()),
    requeue: cardUpdate.due - now.getTime() <= SAME_SESSION_WINDOW_MS,
  };
}

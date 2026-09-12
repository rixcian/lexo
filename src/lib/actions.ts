"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, sqlite } from "@/db";
import { cards, decks, notes, reviews } from "@/db/schema";
import { fingerprint } from "@/lib/fingerprint";
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
  const parsed = deckInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid deck");
  }

  db.update(decks).set(parsed.data).where(eq(decks.id, deckId)).run();
  revalidatePath("/");
  revalidatePath(`/decks/${deckId}`);
}

export async function setDeckArchivedAction(deckId: number, archived: boolean) {
  db.update(decks).set({ archived }).where(eq(decks.id, deckId)).run();
  revalidatePath("/");
  revalidatePath(`/decks/${deckId}`);
}

export async function deleteDeckAction(deckId: number): Promise<void> {
  db.delete(decks).where(eq(decks.id, deckId)).run();
  revalidatePath("/");
  redirect("/");
}

const noteInput = z.object({
  front: z.string().trim().min(1, "The front cannot be empty").max(2000),
  back: z.string().trim().min(1, "The back cannot be empty").max(2000),
  extra: z.string().trim().max(4000).default(""),
  tags: z.string().trim().max(400).default(""),
});

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
  const parsed = noteInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid note" };
  }

  const deck = db.select().from(decks).where(eq(decks.id, deckId)).get();
  if (!deck) return { ok: false, error: "Deck not found" };

  const { front, back, extra } = parsed.data;
  const fp = fingerprint(front, back);

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

    const templates = deck.reverseCards ? ["forward", "reverse"] : ["forward"];
    db.insert(cards)
      .values(
        templates.map((template) => ({
          noteId: note.id,
          deckId,
          template,
          ...fresh,
        })),
      )
      .run();
  })();

  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updateNoteAction(
  noteId: number,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = noteInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid note" };
  }

  const note = db.select().from(notes).where(eq(notes.id, noteId)).get();
  if (!note) return { ok: false, error: "Card not found" };

  db.update(notes)
    .set({
      front: parsed.data.front,
      back: parsed.data.back,
      extra: parsed.data.extra,
      tags: JSON.stringify(parseTags(parsed.data.tags)),
      fingerprint: fingerprint(parsed.data.front, parsed.data.back),
      updatedAt: Date.now(),
    })
    .where(eq(notes.id, noteId))
    .run();

  revalidatePath(`/decks/${note.deckId}`);
  return { ok: true };
}

export async function deleteNoteAction(noteId: number): Promise<ActionResult> {
  const note = db.select().from(notes).where(eq(notes.id, noteId)).get();
  if (!note) return { ok: false, error: "Card not found" };

  db.delete(notes).where(eq(notes.id, noteId)).run();
  revalidatePath(`/decks/${note.deckId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function setCardSuspendedAction(
  cardId: number,
  suspended: boolean,
): Promise<ActionResult> {
  const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
  if (!card) return { ok: false, error: "Card not found" };

  db.update(cards).set({ suspended }).where(eq(cards.id, cardId)).run();
  revalidatePath(`/decks/${card.deckId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Wipes a card's scheduling history and sends it back to the New queue. */
export async function resetCardAction(cardId: number): Promise<ActionResult> {
  const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
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
  if (![1, 2, 3, 4].includes(rating)) {
    return { ok: false, error: "Unknown rating" };
  }

  const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
  if (!card) return { ok: false, error: "Card not found" };

  const now = new Date();
  const { cardUpdate, reviewRow } = gradeCard(card, rating as Grade, now);

  sqlite.transaction(() => {
    db.update(cards).set(cardUpdate).where(eq(cards.id, cardId)).run();
    db.insert(reviews)
      .values({ ...reviewRow, durationMs: Math.max(0, Math.round(durationMs)) })
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

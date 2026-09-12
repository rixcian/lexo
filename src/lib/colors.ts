/**
 * DESIGN.md section 15: the five-accent vocabulary is the whole brand language.
 * Deck "unit colors" may only come from this list - never a sixth hue.
 */
export const DECK_COLORS = [
  "brand",
  "macaw",
  "streak",
  "heart",
  "xp",
  "super",
] as const;

export type DeckColor = (typeof DECK_COLORS)[number];

export const DECK_COLOR_LABEL: Record<DeckColor, string> = {
  brand: "Feather green",
  macaw: "Macaw blue",
  streak: "Streak orange",
  heart: "Heart red",
  xp: "XP gold",
  super: "Super purple",
};

/** Tailwind classes are static strings so the compiler can see every variant. */
export const DECK_COLOR_CLASS: Record<
  DeckColor,
  { border: string; bg: string; text: string; dot: string; buttonVariant: string }
> = {
  brand: {
    border: "border-l-brand",
    bg: "bg-brand",
    text: "text-brand",
    dot: "bg-brand",
    buttonVariant: "duo",
  },
  macaw: {
    border: "border-l-macaw",
    bg: "bg-macaw",
    text: "text-macaw",
    dot: "bg-macaw",
    buttonVariant: "duo-info",
  },
  streak: {
    border: "border-l-streak",
    bg: "bg-streak",
    text: "text-streak",
    dot: "bg-streak",
    buttonVariant: "duo-warning",
  },
  heart: {
    border: "border-l-heart",
    bg: "bg-heart",
    text: "text-heart",
    dot: "bg-heart",
    buttonVariant: "duo-danger",
  },
  xp: {
    border: "border-l-xp",
    bg: "bg-xp",
    text: "text-xp",
    dot: "bg-xp",
    buttonVariant: "duo-xp",
  },
  super: {
    border: "border-l-super",
    bg: "bg-super",
    text: "text-super",
    dot: "bg-super",
    buttonVariant: "duo-super",
  },
};

export function deckColor(value: string): DeckColor {
  return (DECK_COLORS as readonly string[]).includes(value)
    ? (value as DeckColor)
    : "brand";
}

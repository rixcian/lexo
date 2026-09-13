import { DECK_COLORS, type DeckColor } from "@/lib/colors";

/**
 * Accounts borrow the deck accent vocabulary rather than inventing a sixth hue
 * (DESIGN.md section 15). Derived from the id, so a name keeps its colour for
 * as long as the account exists.
 */
export function userAccent(userId: number): DeckColor {
  return DECK_COLORS[userId % DECK_COLORS.length];
}

/** One or two letters for the avatar - "Ada Lovelace" reads as AL. */
export function userInitials(username: string): string {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

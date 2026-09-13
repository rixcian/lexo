/**
 * The whole credential, so the rules live in one place both the form and the
 * action can import - `users.ts` is server-only and a client form cannot touch
 * it.
 */
export const USERNAME_MIN = 2;
export const USERNAME_MAX = 24;

/** Letters, digits, space, dash, underscore - enough for a name, not a slug. */
const USERNAME_SHAPE = /^[\p{L}\p{N} _-]+$/u;

export type UsernameCheck =
  | { ok: true; username: string }
  | { ok: false; error: string };

export function validateUsername(raw: string): UsernameCheck {
  const username = raw.trim().replace(/\s+/g, " ");

  if (username.length < USERNAME_MIN) {
    return { ok: false, error: `A name needs at least ${USERNAME_MIN} characters.` };
  }
  if (username.length > USERNAME_MAX) {
    return { ok: false, error: `Keep it under ${USERNAME_MAX} characters.` };
  }
  if (!USERNAME_SHAPE.test(username)) {
    return { ok: false, error: "Letters, numbers, spaces, - and _ only." };
  }
  return { ok: true, username };
}

/**
 * Kept apart from `session.ts` so `proxy.ts` can name the cookie without
 * pulling the database (and `server-only`) into the proxy bundle.
 */
export const SESSION_COOKIE = "lexo_session";

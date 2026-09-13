import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

export { SESSION_COOKIE };

/** Long-lived on purpose: this is a household app, not a bank. */
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/** The cookie carries the token; the database only ever sees this. */
function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * A self-hosted instance is as likely to be served over plain http on a LAN as
 * behind a TLS proxy, and a `Secure` cookie on http is simply dropped - so ask
 * the request which one this is.
 */
async function isHttps(): Promise<boolean> {
  const store = await headers();
  const proto = store.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return store.get("x-forwarded-ssl") === "on";
}

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_MS;

  // Signing in is the natural moment to sweep; nothing else ever would.
  db.delete(sessions).where(lt(sessions.expiresAt, Date.now())).run();
  db.insert(sessions).values({ id: tokenHash(token), userId, expiresAt }).run();

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: await isHttps(),
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    db.delete(sessions).where(eq(sessions.id, tokenHash(token))).run();
  }
  store.delete(SESSION_COOKIE);
}

/**
 * The signed-in user, or null. Memoized for the render pass so a page, its
 * layout and every query it runs share one lookup.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, tokenHash(token)))
    .get();

  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    db.delete(sessions).where(eq(sessions.id, tokenHash(token))).run();
    return null;
  }

  return row.user;
});

/**
 * The guard every page, action and route handler that touches a collection
 * starts with. `proxy.ts` turns most unauthenticated requests away earlier,
 * but only this check has actually looked at the database.
 */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

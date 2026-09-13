"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, currentUser, destroySession } from "@/lib/auth/session";
import {
  createUser,
  getUser,
  usernameTaken,
  validateUsername,
} from "@/lib/auth/users";

/** Actions here only ever return on failure - success redirects. */
export type AuthError = { ok: false; error: string };

/**
 * Registration is a username and nothing else - see `users` in the schema for
 * why there is no password. Returns only on failure; success redirects.
 */
export async function registerAction(formData: FormData): Promise<AuthError | void> {
  const raw = formData.get("username");
  const checked = validateUsername(typeof raw === "string" ? raw : "");
  if (!checked.ok) return { ok: false, error: checked.error };

  if (usernameTaken(checked.username)) {
    return { ok: false, error: `${checked.username} is already taken.` };
  }

  // Adding the second person is done from Settings by someone already signed
  // in - creating their account should not sign the adder out of their own.
  const adder = await currentUser();

  const user = createUser(checked.username);
  if (!adder) await createSession(user.id);

  revalidatePath("/", "layout");
  redirect(adder ? "/settings" : "/");
}

/** Signing in is picking your name off the list. */
export async function signInAction(userId: number): Promise<AuthError | void> {
  const user = getUser(userId);
  if (!user || user.username === "") {
    return { ok: false, error: "That account is gone." };
  }

  await createSession(user.id);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await destroySession();

  revalidatePath("/", "layout");
  redirect("/login");
}

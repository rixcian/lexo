"use client";

import { useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/account/user-avatar";
import { toastManager } from "@/components/ui/toast";
import { signInAction } from "@/lib/auth/actions";

export interface PickableUser {
  id: number;
  username: string;
}

/** Signing in is picking your name, so the names are the buttons. */
export function AccountPicker({ users }: { users: PickableUser[] }) {
  const [pending, startTransition] = useTransition();

  function pick(userId: number) {
    startTransition(async () => {
      const result = await signInAction(userId);
      if (result && !result.ok) {
        toastManager.add({
          title: "Could not sign in",
          description: result.error,
          type: "error",
        });
      }
    });
  }

  return (
    <ul className="flex w-full flex-col gap-3">
      {users.map((user) => (
        <li key={user.id}>
          <button
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-border border-b-4 bg-card px-5 py-4 text-left transition-[transform,background-color] hover:bg-accent active:translate-y-0.5 active:border-b-2 focus-visible:ring-3 focus-visible:ring-macaw focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-64"
            disabled={pending}
            onClick={() => pick(user.id)}
            type="button"
          >
            <UserAvatar
              className="size-11"
              userId={user.id}
              username={user.username}
            />
            <span className="type-h4 min-w-0 flex-1 truncate text-card-foreground">
              {user.username}
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}

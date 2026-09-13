"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/lib/auth/actions";
import { USERNAME_MAX } from "@/lib/auth/username";

type State = { error?: string };

async function submit(_state: State, formData: FormData): Promise<State> {
  // A successful registration redirects, so anything returned is a refusal.
  const result = await registerAction(formData);
  return result ? { error: result.error } : {};
}

export function RegisterForm({
  first,
  adding,
}: {
  /** No accounts exist yet - this name inherits the existing collection. */
  first: boolean;
  /** Someone signed in is setting up an account for the other person. */
  adding: boolean;
}) {
  const [state, action] = useActionState<State, FormData>(submit, {});

  return (
    <form action={action} className="flex w-full flex-col gap-5">
      <div className="grid gap-2">
        <Label className="type-label" htmlFor="username">
          What should we call you?
        </Label>
        <Input
          autoComplete="username"
          autoFocus
          className="rounded-xl border-2"
          id="username"
          maxLength={USERNAME_MAX}
          name="username"
          placeholder="Rosti"
          required
          size="duo"
        />
        <p className="type-caption text-muted-foreground">
          {first
            ? "This name takes over the decks and the streak that are already here."
            : "Your decks are shared with everyone here; your progress is your own."}
        </p>
      </div>

      {state.error ? (
        // Section 4: toast-style feedback - white bg, left border in the role.
        <p
          className="type-body-sm flex items-start gap-2 rounded-xl border-l-4 border-heart bg-card px-4 py-3 text-card-foreground shadow-card"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-heart" />
          {state.error}
        </p>
      ) : null}

      <Submit label={adding ? "Add account" : "Start learning"} />
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} size="duo-lg" type="submit" variant="duo">
      {pending ? "Setting up..." : label}
    </Button>
  );
}

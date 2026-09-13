import Link from "next/link";
import type { Metadata } from "next";
import { DeckForm } from "@/components/deck-form";
import { Button } from "@/components/ui/button";
import { createDeckAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New deck" };

export default async function NewDeckPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="type-h1 text-card-foreground">New deck</h1>
      <p className="type-body-lg mt-2 mb-8 text-muted-foreground">
        Any language pair works - the app only cares about a front and a back.
      </p>

      <DeckForm action={createDeckAction}>
        <Button type="submit" variant="duo" size="duo-lg">
          Create deck
        </Button>
        <Button render={<Link href="/" />} variant="duo-ghost" size="duo">
          Maybe later
        </Button>
      </DeckForm>
    </div>
  );
}

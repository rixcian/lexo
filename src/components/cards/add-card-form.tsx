"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { NoteFields } from "@/components/cards/note-fields";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import { createNoteAction } from "@/lib/actions";

export function AddCardForm({
  deckId,
  frontLabel,
  backLabel,
}: {
  deckId: number;
  frontLabel?: string;
  backLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createNoteAction(deckId, formData);
      if (result.ok) {
        form.reset();
        form.querySelector<HTMLInputElement>("input[name='front']")?.focus();
        toastManager.add({ title: "Card added", type: "success" });
      } else {
        toastManager.add({ title: "Hmm, not quite", description: result.error, type: "error" });
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex flex-col gap-5 rounded-[20px] bg-card p-6 shadow-card"
    >
      <h2 className="type-h3 text-card-foreground">Add a card</h2>
      <NoteFields idPrefix="add" frontLabel={frontLabel} backLabel={backLabel} />
      <div>
        <Button type="submit" variant="duo" size="duo" loading={pending}>
          <Plus />
          Save it
        </Button>
      </div>
    </form>
  );
}

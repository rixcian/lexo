"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteDeckAction, setDeckArchivedAction } from "@/lib/actions";

export function DeckDangerZone({
  deckId,
  deckName,
  archived,
}: {
  deckId: number;
  deckName: string;
  archived: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border-2 border-heart/30 p-6">
      <h2 className="type-h3 text-card-foreground">Careful zone</h2>
      <p className="type-body-sm text-muted-foreground">
        Archiving hides a deck from the home screen but keeps every card and its
        history. Deleting does not.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="duo-secondary"
          size="duo"
          disabled={pending}
          onClick={() =>
            startTransition(() => setDeckArchivedAction(deckId, !archived))
          }
        >
          {archived ? <ArchiveRestore /> : <Archive />}
          {archived ? "Unarchive deck" : "Archive deck"}
        </Button>

        <Button variant="duo-danger" size="duo" onClick={() => setOpen(true)}>
          <Trash2 />
          Delete deck
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deckName}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Every card and every review in this deck is removed. Type the deck
              name to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 py-2">
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={deckName}
              aria-label="Type the deck name to confirm"
              className="h-12 rounded-xl border-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="duo-secondary" size="duo-sm" />}>
              Keep it
            </AlertDialogClose>
            <Button
              variant="duo-danger"
              size="duo-sm"
              loading={pending}
              disabled={confirmText.trim() !== deckName}
              onClick={() => startTransition(() => deleteDeckAction(deckId))}
            >
              Delete forever
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </section>
  );
}

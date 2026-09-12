"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { NoteFields } from "@/components/cards/note-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toastManager } from "@/components/ui/toast";
import { emptyMediaMap, type NoteMediaMap } from "@/lib/media/types";
import {
  deleteNoteAction,
  resetCardAction,
  setCardSuspendedAction,
  updateNoteAction,
} from "@/lib/actions";

export interface CardRow {
  cardId: number;
  noteId: number;
  front: string;
  back: string;
  extra: string;
  tags: string[];
  suspended: boolean;
  media?: NoteMediaMap;
}

export function CardRowActions({ row }: { row: CardRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(
    task: () => Promise<{ ok: boolean; error?: string }>,
    successTitle: string,
    onDone?: () => void,
  ) {
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        toastManager.add({ title: successTitle, type: "success" });
        onDone?.();
      } else {
        toastManager.add({
          title: "Hmm, not quite",
          description: result.error,
          type: "error",
        });
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Edit card"
        onClick={() => setEditOpen(true)}
      >
        <Pencil />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label={row.suspended ? "Unsuspend card" : "Suspend card"}
        disabled={pending}
        onClick={() =>
          run(
            () => setCardSuspendedAction(row.cardId, !row.suspended),
            row.suspended ? "Back in rotation" : "Card suspended",
          )
        }
      >
        {row.suspended ? <EyeOff /> : <Eye />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Reset scheduling"
        disabled={pending}
        onClick={() => run(() => resetCardAction(row.cardId), "Back to new")}
      >
        <RotateCcw />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete card"
        className="text-destructive-foreground"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 />
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogPopup className="max-w-2xl">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              run(() => updateNoteAction(row.noteId, formData), "Saved", () =>
                setEditOpen(false),
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit card</DialogTitle>
              <DialogDescription>
                Editing the text does not reset the card&apos;s schedule.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-5 px-6 py-2">
              <NoteFields
                idPrefix={`edit-${row.noteId}`}
                defaults={row}
                media={row.media ?? emptyMediaMap()}
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="duo-secondary" size="duo-sm" />}>
                Cancel
              </DialogClose>
              <Button type="submit" variant="duo" size="duo-sm" loading={pending}>
                Save it
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this card?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{row.front || row.back}&rdquo; and its review history go away
              for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button variant="duo-secondary" size="duo-sm" />}
            >
              Keep it
            </AlertDialogClose>
            <Button
              variant="duo-danger"
              size="duo-sm"
              loading={pending}
              onClick={() =>
                run(() => deleteNoteAction(row.noteId), "Card deleted", () =>
                  setDeleteOpen(false),
                )
              }
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}

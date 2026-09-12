"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, ImagePlus, Music, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MEDIA_FIELDS,
  emptyMediaMap,
  type AttachedMedia,
  type MediaField,
  type MediaKind,
  type NoteMediaMap,
} from "@/lib/media/types";
import { cn } from "@/lib/utils";

export interface NoteDefaults {
  front?: string;
  back?: string;
  extra?: string;
  tags?: string[];
}

type PickedFiles = Record<MediaField, File[]>;

const NO_FILES: PickedFiles = { front: [], back: [], extra: [] };

/** Section 4: inputs are 2px border, radius 12, padding 12x16. */
export function NoteFields({
  idPrefix,
  frontLabel = "Front",
  backLabel = "Back",
  defaults,
  media = emptyMediaMap(),
  autoFocus = false,
}: {
  idPrefix: string;
  frontLabel?: string;
  backLabel?: string;
  defaults?: NoteDefaults;
  /** Files already attached to the note being edited. */
  media?: NoteMediaMap;
  autoFocus?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<PickedFiles>(NO_FILES);
  /** `note_media` row ids (not media ids) struck off but not yet saved. */
  const [removed, setRemoved] = useState<number[]>([]);

  // The file inputs are what the surrounding <form> actually submits, so the
  // picked-files state is mirrored back into them whenever it changes - that is
  // the only way to drop one file from a selection of three.
  useEffect(() => {
    for (const field of MEDIA_FIELDS) {
      const input = root.current?.querySelector<HTMLInputElement>(
        `input[name="media:${field}"]`,
      );
      if (!input) continue;
      const transfer = new DataTransfer();
      for (const file of picked[field]) transfer.items.add(file);
      input.files = transfer.files;
    }
  }, [picked]);

  // "Add a card" resets the form after a successful save; the attachments have
  // to go with it.
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;

    const onReset = () => {
      setPicked(NO_FILES);
      setRemoved([]);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const kept = (field: MediaField) =>
    media[field].filter((file) => !removed.includes(file.attachmentId));

  /** A side with a picture or a clip on it does not also need text. */
  const needsText = (field: MediaField) =>
    kept(field).length === 0 && picked[field].length === 0;

  const attachmentProps = (field: MediaField) => ({
    field,
    idPrefix,
    attached: kept(field),
    picked: picked[field],
    onAdd: (files: File[]) =>
      setPicked((prev) => ({ ...prev, [field]: [...prev[field], ...files] })),
    onDropPicked: (index: number) =>
      setPicked((prev) => ({
        ...prev,
        [field]: prev[field].filter((_, i) => i !== index),
      })),
    onDropAttached: (id: number) => setRemoved((prev) => [...prev, id]),
  });

  return (
    <div ref={root} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-front`} className="type-label">
            {frontLabel}
          </Label>
          <Input
            id={`${idPrefix}-front`}
            name="front"
            required={needsText("front")}
            autoFocus={autoFocus}
            defaultValue={defaults?.front}
            placeholder="el perro"
            size="duo"
            className="rounded-xl border-2"
          />
          <Attachments {...attachmentProps("front")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-back`} className="type-label">
            {backLabel}
          </Label>
          <Input
            id={`${idPrefix}-back`}
            name="back"
            required={needsText("back")}
            defaultValue={defaults?.back}
            placeholder="the dog"
            size="duo"
            className="rounded-xl border-2"
          />
          <Attachments {...attachmentProps("back")} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-extra`} className="type-label">
          Notes <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={`${idPrefix}-extra`}
          name="extra"
          rows={2}
          defaultValue={defaults?.extra}
          placeholder="El perro corre por el parque."
          className="rounded-xl border-2"
        />
        <Attachments {...attachmentProps("extra")} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-tags`} className="type-label">
          Tags <span className="text-muted-foreground">(space separated)</span>
        </Label>
        <Input
          id={`${idPrefix}-tags`}
          name="tags"
          defaultValue={defaults?.tags?.join(" ")}
          placeholder="animals noun a1"
          size="duo"
          className="rounded-xl border-2"
        />
      </div>

      {/* Read by the update action to detach files the user struck off. */}
      <input type="hidden" name="removeMedia" value={JSON.stringify(removed)} />
    </div>
  );
}

function Attachments({
  field,
  idPrefix,
  attached,
  picked,
  onAdd,
  onDropPicked,
  onDropAttached,
}: {
  field: MediaField;
  idPrefix: string;
  attached: AttachedMedia[];
  picked: File[];
  onAdd: (files: File[]) => void;
  onDropPicked: (index: number) => void;
  onDropAttached: (id: number) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {attached.map((file) => (
        <Chip
          key={file.attachmentId}
          label={file.filename}
          kind={file.kind}
          thumbnail={file.kind === "image" ? file.url : undefined}
          onRemove={() => onDropAttached(file.attachmentId)}
        />
      ))}
      {picked.map((file, index) => (
        <Chip
          key={`${file.name}-${index}`}
          label={file.name}
          kind={file.type.startsWith("image/") ? "image" : "audio"}
          pending
          onRemove={() => onDropPicked(index)}
        />
      ))}

      <Button
        type="button"
        variant="duo-ghost"
        size="duo-sm"
        onClick={() => picker.current?.click()}
      >
        <ImagePlus />
        Attach
      </Button>

      <input
        ref={picker}
        id={`${idPrefix}-media-${field}`}
        name={`media:${field}`}
        type="file"
        accept="image/*,audio/*"
        multiple
        className="sr-only"
        aria-label={`Attach an image or audio clip to the ${field}`}
        onChange={(event) => {
          // The parent mirrors its state back into this input, so the freshly
          // picked files are handed over rather than left to be read back.
          const files = [...(event.target.files ?? [])];
          if (files.length > 0) onAdd(files);
        }}
      />
    </div>
  );
}

function Chip({
  label,
  kind,
  thumbnail,
  pending = false,
  onRemove,
}: {
  label: string;
  kind: MediaKind;
  thumbnail?: string;
  pending?: boolean;
  onRemove: () => void;
}) {
  const Icon = kind === "image" ? ImageIcon : Music;

  return (
    <span
      className={cn(
        // §6 Standard: inline tags take the 8px tier.
        "inline-flex max-w-[220px] items-center gap-1.5 rounded-lg bg-secondary py-1 pr-1 pl-2",
        pending && "border-2 border-dashed border-input",
      )}
    >
      {thumbnail ? (
        // A 20px chip thumbnail of an already-local file has nothing to gain
        // from the image pipeline.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnail} alt="" className="size-5 rounded object-cover" />
      ) : (
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="type-caption truncate text-secondary-foreground">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </span>
  );
}

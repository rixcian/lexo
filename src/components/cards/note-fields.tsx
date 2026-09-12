import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface NoteDefaults {
  front?: string;
  back?: string;
  extra?: string;
  tags?: string[];
}

/** Section 4: inputs are 2px border, radius 12, padding 12x16. */
export function NoteFields({
  idPrefix,
  frontLabel = "Front",
  backLabel = "Back",
  defaults,
  autoFocus = false,
}: {
  idPrefix: string;
  frontLabel?: string;
  backLabel?: string;
  defaults?: NoteDefaults;
  autoFocus?: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-front`} className="type-label">
            {frontLabel}
          </Label>
          <Input
            id={`${idPrefix}-front`}
            name="front"
            required
            autoFocus={autoFocus}
            defaultValue={defaults?.front}
            placeholder="el perro"
            className="h-12 rounded-xl border-2"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-back`} className="type-label">
            {backLabel}
          </Label>
          <Input
            id={`${idPrefix}-back`}
            name="back"
            required
            defaultValue={defaults?.back}
            placeholder="the dog"
            className="h-12 rounded-xl border-2"
          />
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
          className="h-12 rounded-xl border-2"
        />
      </div>
    </>
  );
}

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DECK_COLORS, DECK_COLOR_CLASS, DECK_COLOR_LABEL } from "@/lib/colors";
import type { Deck } from "@/db/schema";
import { cn } from "@/lib/utils";

interface DeckFormProps {
  action: (formData: FormData) => void | Promise<void>;
  deck?: Deck;
  children: React.ReactNode;
}

/**
 * Plain HTML form posted straight to a server action - no client state needed,
 * so the page works before hydration (and in the offline shell).
 */
export function DeckForm({ action, deck, children }: DeckFormProps) {
  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="grid gap-2">
        <Label htmlFor="name" className="type-label">
          Deck name
        </Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={80}
          defaultValue={deck?.name}
          placeholder="Spanish - top 1000 verbs"
          className="h-12 rounded-xl border-2"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description" className="type-label">
          Description <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          maxLength={400}
          defaultValue={deck?.description}
          placeholder="What is in this deck?"
          className="rounded-xl border-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="frontLang" className="type-label">
            Front language
          </Label>
          <Input
            id="frontLang"
            name="frontLang"
            defaultValue={deck?.frontLang}
            placeholder="Spanish"
            className="h-12 rounded-xl border-2"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="backLang" className="type-label">
            Back language
          </Label>
          <Input
            id="backLang"
            name="backLang"
            defaultValue={deck?.backLang}
            placeholder="English"
            className="h-12 rounded-xl border-2"
          />
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className="type-label mb-2">Unit color</legend>
        <div className="flex flex-wrap gap-3">
          {DECK_COLORS.map((color) => (
            <label
              key={color}
              className="group cursor-pointer"
              title={DECK_COLOR_LABEL[color]}
            >
              <input
                type="radio"
                name="color"
                value={color}
                defaultChecked={(deck?.color ?? "brand") === color}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-full border-4 border-transparent transition-transform peer-checked:border-foreground/20 peer-focus-visible:ring-3 peer-focus-visible:ring-macaw peer-focus-visible:ring-offset-2",
                  DECK_COLOR_CLASS[color].dot,
                )}
              >
                <span className="sr-only">{DECK_COLOR_LABEL[color]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="newPerDay" className="type-label">
            New cards per day
          </Label>
          <Input
            id="newPerDay"
            name="newPerDay"
            type="number"
            min={0}
            max={9999}
            defaultValue={deck?.newPerDay ?? 20}
            className="h-12 rounded-xl border-2"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="reviewsPerDay" className="type-label">
            Reviews per day
          </Label>
          <Input
            id="reviewsPerDay"
            name="reviewsPerDay"
            type="number"
            min={0}
            max={9999}
            defaultValue={deck?.reviewsPerDay ?? 200}
            className="h-12 rounded-xl border-2"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-border p-4">
        <input
          type="checkbox"
          name="reverseCards"
          defaultChecked={deck?.reverseCards ?? false}
          className="mt-1 size-5 accent-[var(--brand)]"
        />
        <span>
          <span className="type-label block">Also study back to front</span>
          <span className="type-caption block text-muted-foreground">
            Creates a second card per note. Only applies to cards added after
            this is switched on.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 pt-2">{children}</div>
    </form>
  );
}

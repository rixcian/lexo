import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { CountPills, Pill } from "@/components/duo/chips";
import { Button } from "@/components/ui/button";
import { DECK_COLOR_CLASS, deckColor } from "@/lib/colors";
import type { DeckWithCounts } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function DeckCard({ deck }: { deck: DeckWithCounts }) {
  const color = DECK_COLOR_CLASS[deckColor(deck.color)];
  const due = deck.counts.total;
  const langs = [deck.frontLang, deck.backLang].filter(Boolean).join(" to ");

  return (
    // Section 4: featured cards get a 3px solid border in their unit color.
    <article
      className={cn(
        "group flex flex-col gap-4 rounded-[20px] border-0 border-l-[6px] bg-card p-6 shadow-card transition-shadow duration-200 hover:shadow-card-hover",
        color.border,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/decks/${deck.id}`}
            // Wrap to two lines rather than truncating: "Spanish - Core 1000"
            // and "Capitals of the World" are ordinary names, not edge cases.
            className="type-h3 line-clamp-2 block text-balance break-words text-card-foreground hover:underline focus-visible:ring-3 focus-visible:ring-macaw focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {deck.name}
          </Link>
          <p className="type-caption mt-1 text-muted-foreground">
            {langs ? `${langs} - ` : ""}
            {deck.counts.cardTotal} card{deck.counts.cardTotal === 1 ? "" : "s"}
          </p>
        </div>
        {due > 0 ? (
          <Pill tone="brand" aria-label={`${due} cards ready`}>
            <span aria-hidden="true">{due} ready</span>
          </Pill>
        ) : (
          <Pill tone="outline">
            <Layers className="size-3.5" aria-hidden="true" />
            <span>Done</span>
          </Pill>
        )}
      </div>

      {deck.description ? (
        <p className="type-body-sm line-clamp-2 text-muted-foreground">
          {deck.description}
        </p>
      ) : null}

      <CountPills
        newDue={deck.counts.newDue}
        learningDue={deck.counts.learningDue}
        reviewDue={deck.counts.reviewDue}
      />

      <div className="mt-auto flex items-center gap-3 pt-2">
        {due > 0 ? (
          <Button
            render={<Link href={`/study/${deck.id}`} />}
            variant={
              color.buttonVariant as React.ComponentProps<
                typeof Button
              >["variant"]
            }
            size="duo"
            className="flex-1"
          >
            {deck.counts.reviewDue > 0 ? "Continue" : "Start"}
            <ArrowRight />
          </Button>
        ) : (
          <Button
            render={<Link href={`/decks/${deck.id}`} />}
            variant="duo-secondary"
            size="duo"
            className="flex-1"
          >
            Browse cards
          </Button>
        )}
      </div>
    </article>
  );
}

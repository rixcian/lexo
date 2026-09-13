import Link from "next/link";
import { Download, Plus, Sparkles } from "lucide-react";
import { DeckCard } from "@/components/duo/deck-card";
import { Mascot } from "@/components/duo/mascot";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { listDecks } from "@/lib/queries";
import { todaySummary } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const decks = listDecks(user.id);
  const today = todaySummary(user.id);
  const due = decks.reduce((n, deck) => n + deck.counts.total, 0);
  const firstDue = decks.find((deck) => deck.counts.total > 0);

  if (decks.length === 0) {
    return <EmptyLibrary />;
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Section 5: hero is white with a colored illustration */}
      <section className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-[720px]">
          <p className="type-eyebrow text-muted-foreground">
            {today.reviews > 0
              ? `${today.reviews} reviewed today`
              : "Nothing reviewed yet today"}
          </p>
          <h1 className="type-h1 mt-2 text-card-foreground">
            {due > 0 ? (
              <>
                {due} card{due === 1 ? "" : "s"} are waiting.
              </>
            ) : (
              <>You are all caught up.</>
            )}
          </h1>
          <p className="type-body-lg mt-3 text-muted-foreground">
            {due > 0
              ? "Keep the flame lit - a short session beats a long one tomorrow."
              : "Come back later, or add a few cards while you are here."}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {firstDue ? (
              <Button
                render={<Link href={`/study/${firstDue.id}`} />}
                variant="duo"
                size="duo-lg"
              >
                <Sparkles />
                Continue learning
              </Button>
            ) : null}
            <Button
              render={<Link href="/decks/new" />}
              variant="duo-secondary"
              size={firstDue ? "duo" : "duo-lg"}
            >
              <Plus />
              New deck
            </Button>
            <Button render={<Link href="/import" />} variant="duo-ghost" size="duo">
              <Download />
              Import
            </Button>
          </div>
        </div>

        <Mascot
          mood={due > 0 ? "idle" : "happy"}
          bob
          className="hidden size-40 shrink-0 sm:block lg:size-52"
        />
      </section>

      <section>
        <h2 className="type-h2 mb-5 text-card-foreground">Your decks</h2>
        {/* Section 5: 3-up desktop, 2-up tablet, 1-up mobile */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      </section>
    </div>
  );
}

function EmptyLibrary() {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col items-center gap-6 py-16 text-center">
      <Mascot mood="thinking" className="size-44" bob />
      <h1 className="type-h1 text-card-foreground">
        You haven&apos;t started yet - let&apos;s fix that.
      </h1>
      <p className="type-body-lg text-muted-foreground">
        Import an Anki deck or a CSV of words, or write your first few cards by
        hand. Everything stays on your own machine.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button render={<Link href="/import" />} variant="duo" size="duo-lg">
          <Download />
          Import a deck
        </Button>
        <Button
          render={<Link href="/decks/new" />}
          variant="duo-secondary"
          size="duo-lg"
        >
          <Plus />
          Start from scratch
        </Button>
      </div>
    </div>
  );
}

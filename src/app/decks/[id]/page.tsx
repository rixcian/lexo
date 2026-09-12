import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Search, Settings2, Sparkles } from "lucide-react";
import { AddCardForm } from "@/components/cards/add-card-form";
import { CardRowActions } from "@/components/cards/card-row-actions";
import { CountPills, Pill } from "@/components/duo/chips";
import { Mascot } from "@/components/duo/mascot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DECK_COLOR_CLASS, deckColor } from "@/lib/colors";
import { browseCards, getDeck, getDeckCounts, safeTags } from "@/lib/queries";
import { STATE_LABEL } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const deck = getDeck(Number(id));
  return { title: deck?.name ?? "Deck" };
}

export default async function DeckPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { q, page } = await searchParams;

  const deck = getDeck(Number(id));
  if (!deck) notFound();

  const counts = getDeckCounts(deck);
  const color = DECK_COLOR_CLASS[deckColor(deck.color)];
  const browse = browseCards(deck.id, {
    search: q?.trim() || undefined,
    page: Number(page) || 1,
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className={cn("size-3 shrink-0 rounded-full", color.dot)} />
              <h1 className="type-h1 truncate text-card-foreground">
                {deck.name}
              </h1>
            </div>
            {deck.description ? (
              <p className="type-body-lg mt-2 max-w-[720px] text-muted-foreground">
                {deck.description}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <Button
              render={<Link href={`/decks/${deck.id}/settings`} />}
              variant="duo-secondary"
              size="duo"
            >
              <Settings2 />
              Settings
            </Button>
            {/* An anchor cannot be disabled, so swap the element when nothing is due. */}
            {counts.total > 0 ? (
              <Button
                render={<Link href={`/study/${deck.id}`} />}
                variant="duo"
                size="duo"
              >
                <Sparkles />
                Study
              </Button>
            ) : (
              <Button variant="duo" size="duo" disabled>
                <Sparkles />
                Nothing due
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <CountPills
            newDue={counts.newDue}
            learningDue={counts.learningDue}
            reviewDue={counts.reviewDue}
          />
          <Pill tone="muted">{counts.cardTotal} cards total</Pill>
          {deck.frontLang || deck.backLang ? (
            <Pill tone="outline">
              {[deck.frontLang, deck.backLang].filter(Boolean).join(" to ")}
            </Pill>
          ) : null}
        </div>
      </header>

      <AddCardForm
        deckId={deck.id}
        frontLabel={deck.frontLang || "Front"}
        backLabel={deck.backLang || "Back"}
      />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="type-h2 text-card-foreground">
            Cards{" "}
            <span className="type-body text-muted-foreground">
              ({browse.total})
            </span>
          </h2>

          <form
            className="flex items-center gap-2"
            action={`/decks/${deck.id}`}
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search cards"
                aria-label="Search cards"
                size="duo-sm"
                className="rounded-xl border-2 pl-9"
              />
            </div>
            <Button type="submit" variant="duo-secondary" size="duo-sm">
              Search
            </Button>
          </form>
        </div>

        {browse.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-[20px] bg-card p-12 text-center shadow-card">
            <Mascot mood="thinking" className="size-28" />
            <p className="type-h4 text-card-foreground">
              {q ? "Nothing matched that." : "No cards in here yet."}
            </p>
            <p className="type-body text-muted-foreground">
              {q
                ? "Try a shorter search."
                : "Add one above, or import a deck file."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[20px] bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{deck.frontLang || "Front"}</TableHead>
                  <TableHead>{deck.backLang || "Back"}</TableHead>
                  <TableHead className="w-32">State</TableHead>
                  <TableHead className="w-28">Due</TableHead>
                  <TableHead className="w-44 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {browse.rows.map(({ card, note, dueLabel }) => {
                  return (
                    <TableRow key={card.id}>
                      <TableCell className="max-w-[280px]">
                        <span className="type-body-bold block truncate">
                          {card.template === "reverse" ? note.back : note.front}
                        </span>
                        {note.extra ? (
                          <span className="type-caption block truncate text-muted-foreground">
                            {note.extra}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <span className="block truncate">
                          {card.template === "reverse" ? note.front : note.back}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Pill
                          tone={
                            card.suspended
                              ? "outline"
                              : card.state === 0
                                ? "macaw"
                                : card.state === 2
                                  ? "brand"
                                  : "streak"
                          }
                        >
                          {card.suspended
                            ? "Suspended"
                            : STATE_LABEL[card.state]}
                        </Pill>
                      </TableCell>
                      <TableCell className="type-caption text-muted-foreground">
                        {dueLabel}
                      </TableCell>
                      <TableCell>
                        <CardRowActions
                          row={{
                            cardId: card.id,
                            noteId: note.id,
                            front: note.front,
                            back: note.back,
                            extra: note.extra,
                            tags: safeTags(note.tags),
                            suspended: card.suspended,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {browse.pages > 1 ? (
          <nav
            className="flex items-center justify-center gap-2"
            aria-label="Pagination"
          >
            {Array.from({ length: browse.pages }, (_, i) => i + 1)
              .filter(
                (n) =>
                  n === 1 ||
                  n === browse.pages ||
                  Math.abs(n - browse.page) <= 2,
              )
              .map((n, index, all) => (
                <span key={n} className="flex items-center gap-2">
                  {index > 0 && all[index - 1] !== n - 1 ? (
                    <span className="text-muted-foreground">...</span>
                  ) : null}
                  <Button
                    render={
                      <Link
                        href={{
                          pathname: `/decks/${deck.id}`,
                          query: { ...(q ? { q } : {}), page: n },
                        }}
                      />
                    }
                    variant={n === browse.page ? "duo" : "duo-secondary"}
                    size="duo-sm"
                    aria-current={n === browse.page ? "page" : undefined}
                  >
                    {n}
                  </Button>
                </span>
              ))}
          </nav>
        ) : null}
      </section>
    </div>
  );
}

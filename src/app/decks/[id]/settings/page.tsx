import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { DeckDangerZone } from "@/components/deck-danger-zone";
import { DeckExport } from "@/components/deck-export";
import { DeckForm } from "@/components/deck-form";
import { Button } from "@/components/ui/button";
import { updateDeckAction } from "@/lib/actions";
import { deckMediaCount, getDeck, getDeckCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const deck = getDeck(Number(id));
  return { title: deck ? `${deck.name} settings` : "Deck settings" };
}

export default async function DeckSettingsPage({ params }: PageProps) {
  const { id } = await params;
  const deck = getDeck(Number(id));
  if (!deck) notFound();

  const action = updateDeckAction.bind(null, deck.id);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-10">
      <div>
        <Button
          render={<Link href={`/decks/${deck.id}`} />}
          variant="duo-ghost"
          size="duo-sm"
          className="-ml-4"
        >
          <ArrowLeft />
          Back to deck
        </Button>
        <h1 className="type-h1 mt-3 text-card-foreground">Deck settings</h1>
      </div>

      <DeckForm action={action} deck={deck}>
        <Button type="submit" variant="duo" size="duo-lg">
          Save it
        </Button>
      </DeckForm>

      <DeckExport
        deckId={deck.id}
        cardTotal={getDeckCounts(deck).cardTotal}
        mediaFiles={deckMediaCount(deck.id)}
      />

      <DeckDangerZone deckId={deck.id} deckName={deck.name} archived={deck.archived} />
    </div>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StudySession } from "@/components/study/study-session";
import { requireUser } from "@/lib/auth/session";
import { buildQueue, getDeck } from "@/lib/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ deckId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { deckId } = await params;
  const deck = getDeck(Number(deckId));
  return { title: deck ? `Studying ${deck.name}` : "Study" };
}

export default async function StudyPage({ params }: PageProps) {
  const user = await requireUser();
  const { deckId } = await params;
  const deck = getDeck(Number(deckId));
  if (!deck) notFound();

  return (
    <StudySession
      deckId={deck.id}
      deckName={deck.name}
      deckColorName={deck.color}
      frontLang={deck.frontLang}
      backLang={deck.backLang}
      queue={buildQueue(user.id, deck)}
    />
  );
}

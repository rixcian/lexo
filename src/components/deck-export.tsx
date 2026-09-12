import Link from "next/link";
import { FileDown, Package } from "lucide-react";
import { Pill } from "@/components/duo/chips";
import { Button } from "@/components/ui/button";

/**
 * Both formats are plain downloads, so these are links rather than actions -
 * the route sets Content-Disposition and the browser does the rest.
 */
export function DeckExport({
  deckId,
  cardTotal,
  mediaFiles,
}: {
  deckId: number;
  cardTotal: number;
  mediaFiles: number;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[20px] bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="type-h3 text-card-foreground">Export</h2>
        <Pill tone="muted">{cardTotal} cards</Pill>
        {mediaFiles > 0 ? (
          <Pill tone="macaw">
            {mediaFiles} media file{mediaFiles === 1 ? "" : "s"}
          </Pill>
        ) : null}
      </div>

      <p className="type-body-sm text-muted-foreground">
        Take this deck somewhere else, or keep a copy of your own.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button
          render={
            <Link href={`/api/decks/${deckId}/export?format=apkg`} prefetch={false} />
          }
          variant="duo"
          size="duo"
        >
          <Package />
          Anki package
        </Button>
        <Button
          render={
            <Link href={`/api/decks/${deckId}/export?format=csv`} prefetch={false} />
          }
          variant="duo-secondary"
          size="duo"
        >
          <FileDown />
          CSV
        </Button>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Note term=".apkg">
          Opens in Anki. Carries your cards, tags, images, audio and the review
          log. Anki reads intervals from its own SM-2 columns, so stability and
          difficulty do not survive the trip - but the history does, which is
          what Anki&apos;s FSRS needs to work them out again.
        </Note>
        <Note term=".csv">
          Four columns - front, back, extra, tags - for a spreadsheet or another
          app. Text only: attachments are listed by filename so you can see what
          a row is missing, but the files themselves stay here.
        </Note>
      </dl>
    </section>
  );
}

function Note({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary p-4">
      <dt className="type-label font-mono">{term}</dt>
      <dd className="type-caption mt-1.5 text-muted-foreground">{children}</dd>
    </div>
  );
}

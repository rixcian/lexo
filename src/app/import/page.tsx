import type { Metadata } from "next";
import { ImportWizard } from "@/components/import/import-wizard";
import { listDecks } from "@/lib/queries";

export const metadata: Metadata = { title: "Import" };
export const dynamic = "force-dynamic";

export default function ImportPage() {
  const decks = listDecks(true).map((deck) => ({
    id: deck.id,
    name: deck.name,
  }));

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-8">
      <header>
        <h1 className="type-h1 text-card-foreground">Import a deck</h1>
        <p className="type-body-lg mt-2 text-muted-foreground">
          Anki <code className="font-mono text-[15px]">.apkg</code> exports and
          plain CSV / TSV both work. Duplicates are skipped, so re-importing an
          updated file is safe.
        </p>
      </header>

      <ImportWizard decks={decks} />

      <section className="rounded-[20px] bg-bg-soft p-6">
        <h2 className="type-h4 text-card-foreground">CSV shape</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-card p-4 font-mono text-[13px] leading-6">
          {`front,back,extra,tags
el perro,the dog,El perro corre.,animals noun
la casa,the house,,nouns a1`}
        </pre>
        <p className="type-caption mt-3 text-muted-foreground">
          The header row is optional - you can map columns by hand after
          uploading. A CSV carries text only; images and audio come from an
          .apkg, or you can attach them to a card yourself.
        </p>
      </section>
    </div>
  );
}

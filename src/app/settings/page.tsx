import Link from "next/link";
import type { Metadata } from "next";
import { Archive, Database, Download, Plus } from "lucide-react";
import { Pill } from "@/components/duo/chips";
import { Button } from "@/components/ui/button";
import { DB_PATH } from "@/db";
import { DAY_ROLLOVER_HOUR } from "@/lib/day";
import { listDecks } from "@/lib/queries";
import { DEFAULT_SCHEDULER_CONFIG } from "@/lib/scheduler";
import { formatDuration, lifetimeTotals } from "@/lib/stats";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const totals = lifetimeTotals();
  const archived = listDecks(true).filter((deck) => deck.archived);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-8">
      <header>
        <h1 className="type-h1 text-card-foreground">Settings</h1>
        <p className="type-body-lg mt-2 text-muted-foreground">
          Per-deck limits live on each deck. These are the global bits.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-[20px] bg-card p-6 shadow-card">
        <h2 className="type-h3 text-card-foreground">Scheduler</h2>
        <p className="type-body-sm text-muted-foreground">
          Cards are scheduled with FSRS, the same algorithm modern Anki uses.
          Intervals adapt to how well you actually recall each card.
        </p>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Row
            label="Target retention"
            value={`${Math.round(DEFAULT_SCHEDULER_CONFIG.requestRetention * 100)}%`}
          />
          <Row
            label="Maximum interval"
            value={`${Math.round(DEFAULT_SCHEDULER_CONFIG.maximumInterval / 365)} years`}
          />
          <Row label="Day starts at" value={`${DAY_ROLLOVER_HOUR}:00`} />
        </dl>
      </section>

      <section className="flex flex-col gap-4 rounded-[20px] bg-card p-6 shadow-card">
        <h2 className="type-h3 text-card-foreground">Your collection</h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Row label="Decks" value={String(totals.decks)} />
          <Row label="Cards" value={String(totals.cards)} />
          <Row label="Reviews" value={String(totals.reviews)} />
          <Row label="Time studied" value={formatDuration(totals.durationMs)} />
          <Row label="XP" value={String(totals.xp)} />
        </dl>

        <div className="flex items-start gap-3 rounded-xl bg-secondary p-4">
          <Database className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="type-label">Database file</p>
            <p className="type-caption break-all text-muted-foreground">
              {DB_PATH}
            </p>
            <p className="type-caption mt-1 text-muted-foreground">
              Back it up by copying that file (and its <code>-wal</code>{" "}
              sibling) while the app is stopped.
            </p>
          </div>
        </div>
      </section>

      {archived.length > 0 ? (
        <section className="flex flex-col gap-4 rounded-[20px] bg-card p-6 shadow-card">
          <h2 className="type-h3 text-card-foreground">
            <Archive className="mr-2 inline size-5" aria-hidden="true" />
            Archived decks
          </h2>
          <ul className="flex flex-col gap-2">
            {archived.map((deck) => (
              <li
                key={deck.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3"
              >
                <Link
                  href={`/decks/${deck.id}`}
                  className="type-body-bold truncate hover:underline"
                >
                  {deck.name}
                </Link>
                <Pill tone="outline">{deck.counts.cardTotal} cards</Pill>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button render={<Link href="/import" />} variant="duo" size="duo">
          <Download />
          Import a deck
        </Button>
        <Button
          render={<Link href="/decks/new" />}
          variant="duo-secondary"
          size="duo"
        >
          <Plus />
          New deck
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary px-4 py-3">
      <dt className="type-eyebrow text-muted-foreground">{label}</dt>
      <dd className="type-h4 mt-1 text-card-foreground">{value}</dd>
    </div>
  );
}

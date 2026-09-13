import Link from "next/link";
import type { Metadata } from "next";
import { Archive, Database, Download, LogOut, Plus, UserPlus } from "lucide-react";
import { UserAvatar } from "@/components/account/user-avatar";
import { Pill } from "@/components/duo/chips";
import { Button } from "@/components/ui/button";
import { DB_PATH } from "@/db";
import { signOutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { listUsers } from "@/lib/auth/users";
import { DAY_ROLLOVER_HOUR } from "@/lib/day";
import { listDecks } from "@/lib/queries";
import { DEFAULT_SCHEDULER_CONFIG } from "@/lib/scheduler";
import { formatDuration, lifetimeTotals } from "@/lib/stats";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const totals = lifetimeTotals(user.id);
  const archived = listDecks(user.id, true).filter((deck) => deck.archived);
  const others = listUsers().filter((account) => account.id !== user.id);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-8">
      <header>
        <h1 className="type-h1 text-card-foreground">Settings</h1>
        <p className="type-body-lg mt-2 text-muted-foreground">
          Per-deck limits live on each deck. These are the global bits.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-[20px] bg-card p-6 shadow-card">
        <h2 className="type-h3 text-card-foreground">Account</h2>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar userId={user.id} username={user.username} />
            <div className="min-w-0">
              <p className="type-body-bold truncate text-card-foreground">
                {user.username}
              </p>
              <p className="type-caption text-muted-foreground">
                Signed in on this device
              </p>
            </div>
          </div>

          {/* A plain form, so signing out works before hydration too. */}
          <form action={signOutAction}>
            <Button size="duo-sm" type="submit" variant="duo-secondary">
              <LogOut />
              Sign out
            </Button>
          </form>
        </div>

        <p className="type-body-sm text-muted-foreground">
          Decks, cards and media are shared by everyone here. Scheduling,
          reviews, streak and stats are kept per account, so you can both work
          through the same deck at your own pace.
        </p>

        {others.length > 0 ? (
          <div>
            <p className="type-eyebrow text-muted-foreground">
              Also studying here
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {others.map((account) => (
                <li
                  className="flex items-center gap-2 rounded-full bg-secondary py-1 pr-4 pl-1"
                  key={account.id}
                >
                  <UserAvatar
                    className="size-7 text-[11px]"
                    userId={account.id}
                    username={account.username}
                  />
                  <span className="type-label">{account.username}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <Button
            render={<Link href="/register" />}
            size="duo-sm"
            variant="duo-ghost"
            className="-ml-4"
          >
            <UserPlus />
            Add someone
          </Button>
        </div>
      </section>

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
        <p className="type-body-sm text-muted-foreground">
          Decks and cards are the shared library; the reviews, the time and the
          XP are yours.
        </p>
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

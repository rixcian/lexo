import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart,
  Heatmap,
  RatingBars,
  SectionCard,
  StateBar,
  StatTile,
} from "@/components/stats/charts";
import { Mascot } from "@/components/duo/mascot";
import { Pill } from "@/components/duo/chips";
import { Button } from "@/components/ui/button";
import { DECK_COLOR_CLASS, deckColor } from "@/lib/colors";
import { requireUser } from "@/lib/auth/session";
import { dueForecast } from "@/lib/queries";
import {
  formatDuration,
  heatmap,
  lifetimeTotals,
  perDeckTotals,
  ratingBreakdown,
  retention,
  stateDistribution,
  streak,
  todaySummary,
} from "@/lib/stats";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Stats" };
export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const user = await requireUser();

  const totals = lifetimeTotals(user.id);
  const today = todaySummary(user.id);
  const days = streak(user.id);
  const dist = stateDistribution(user.id);
  const thirtyDay = retention(user.id, 30);
  const breakdown = ratingBreakdown(user.id, 30);
  const calendar = heatmap(user.id, 365);
  const forecast = dueForecast(user.id, 30);
  const decks = perDeckTotals(user.id);

  const last30 = calendar.slice(-30);

  if (totals.cards === 0) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col items-center gap-6 py-16 text-center">
        <Mascot mood="thinking" className="size-36" bob />
        <h1 className="type-h1 text-card-foreground">No numbers yet</h1>
        <p className="type-body-lg text-muted-foreground">
          Stats show up here as soon as you have a deck and a few reviews.
        </p>
        <Button render={<Link href="/import" />} variant="duo" size="duo-lg">
          Import a deck
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="type-h1 text-card-foreground">Stats</h1>
        <p className="type-body-lg mt-2 text-muted-foreground">
          Everything here comes from your own review log.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Streak"
          value={`${days.current}`}
          hint={`Longest ${days.longest} day${days.longest === 1 ? "" : "s"}`}
          tone="streak"
        />
        <StatTile
          label="XP today"
          value={`${today.xp}`}
          hint={`${today.reviews} review${today.reviews === 1 ? "" : "s"}`}
          tone="xp"
        />
        <StatTile
          label="30-day retention"
          value={
            thirtyDay.rate === null
              ? "-"
              : `${Math.round(thirtyDay.rate * 100)}%`
          }
          hint={`${thirtyDay.total} mature review${thirtyDay.total === 1 ? "" : "s"}`}
          tone="brand"
        />
        <StatTile
          label="Time studied"
          value={formatDuration(totals.durationMs)}
          hint={`${totals.reviews} reviews all time`}
          tone="macaw"
        />
      </div>

      <SectionCard
        title="A year of reviews"
        description="One square per day. The 04:00 rollover means a late night still counts as yesterday."
      >
        <Heatmap days={calendar} />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Last 30 days" description="Reviews per day.">
          <BarChart
            data={last30.map((day) => ({
              label: day.date,
              value: day.count,
              title: `${day.date}: ${day.count} reviews`,
            }))}
            colorClass="bg-brand"
          />
        </SectionCard>

        <SectionCard
          title="Coming up"
          description="Cards due over the next 30 days."
        >
          <BarChart
            data={forecast.map((bucket) => ({
              label: `Day ${bucket.day}`,
              value: bucket.count,
              title:
                bucket.day === 0
                  ? `Today: ${bucket.count} due`
                  : `In ${bucket.day} day(s): ${bucket.count} due`,
            }))}
            colorClass="bg-macaw"
            emptyLabel="Nothing scheduled yet."
          />
        </SectionCard>

        <SectionCard
          title="Card states"
          description={`${dist.total} cards across every deck.`}
        >
          <StateBar dist={dist} />
        </SectionCard>

        <SectionCard
          title="How you answered"
          description="Every grade given in the last 30 days."
        >
          <RatingBars breakdown={breakdown} />
        </SectionCard>
      </div>

      <SectionCard title="Per deck" description="Mature means an interval of 21 days or more.">
        <ul className="flex flex-col divide-y divide-border">
          {decks.map((row) => {
            const color = DECK_COLOR_CLASS[deckColor(row.deck.color)];
            return (
              <li
                key={row.deck.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className={cn("size-3 shrink-0 rounded-full", color.dot)} />
                <Link
                  href={`/decks/${row.deck.id}`}
                  className="type-body-bold min-w-0 flex-1 truncate hover:underline"
                >
                  {row.deck.name}
                </Link>
                <Pill tone="outline">{row.cardCount} cards</Pill>
                <Pill tone="outline">{row.matureCount} mature</Pill>
                <Pill tone="muted">{row.reviewCount} reviews</Pill>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </div>
  );
}

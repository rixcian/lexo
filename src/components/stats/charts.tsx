import type { DayBucket, StateDistribution } from "@/lib/stats";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "brand" | "streak" | "xp" | "macaw" | "super" | "heart" | "muted";
}) {
  const tones = {
    brand: "text-brand",
    streak: "text-streak",
    xp: "text-xp",
    macaw: "text-macaw",
    super: "text-super",
    heart: "text-heart",
    muted: "text-card-foreground",
  } as const;

  return (
    <div className="rounded-[20px] bg-card p-6 shadow-card">
      <p className="type-eyebrow text-muted-foreground">{label}</p>
      <p className={cn("type-h1 mt-2", tones[tone])}>{value}</p>
      {hint ? (
        <p className="type-caption mt-1 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[20px] bg-card p-6 shadow-card", className)}>
      <h2 className="type-h3 text-card-foreground">{title}</h2>
      {description ? (
        <p className="type-caption mt-1 text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

const HEAT_LEVELS = [
  "bg-secondary",
  "bg-brand/25",
  "bg-brand/50",
  "bg-brand/75",
  "bg-brand",
];

function heatLevel(count: number, peak: number) {
  if (count === 0) return 0;
  const ratio = count / Math.max(peak, 1);
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/** GitHub-style calendar of review activity, in Feather Green. */
export function Heatmap({ days }: { days: DayBucket[] }) {
  const peak = Math.max(...days.map((d) => d.count), 1);

  // Pad the start so every column is a full Sunday-to-Saturday week.
  const first = new Date(`${days[0]?.date ?? ""}T00:00:00`);
  const pad = Number.isNaN(first.getTime()) ? 0 : first.getDay();
  const cells: (DayBucket | null)[] = [
    ...Array.from({ length: pad }, () => null),
    ...days,
  ];

  const weeks: (DayBucket | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="flex flex-col gap-3">
      {/* Columns flex to fill the card on a wide screen and fall back to a
          scrollable 11px grid once there is no room left. */}
      <div className="overflow-x-auto pb-1">
        <div className="flex w-full gap-[3px]">
          {weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              className="flex min-w-[11px] flex-1 flex-col gap-[3px]"
            >
              {Array.from({ length: 7 }, (_, dayIndex) => {
                const cell = week[dayIndex];
                if (!cell) {
                  return (
                    <div
                      key={dayIndex}
                      className="aspect-square w-full rounded-[3px] opacity-0"
                    />
                  );
                }
                return (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.count} review${cell.count === 1 ? "" : "s"}`}
                    className={cn(
                      "aspect-square w-full rounded-[3px]",
                      HEAT_LEVELS[heatLevel(cell.count, peak)],
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="type-caption flex items-center gap-2 text-muted-foreground">
        <span>Less</span>
        {HEAT_LEVELS.map((level) => (
          <span key={level} className={cn("size-[11px] rounded-[3px]", level)} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

/** Vertical bars. Used for both "reviews per day" and the due forecast. */
export function BarChart({
  data,
  colorClass = "bg-brand",
  emptyLabel = "Nothing here yet.",
}: {
  data: { label: string; value: number; title?: string }[];
  colorClass?: string;
  emptyLabel?: string;
}) {
  const peak = Math.max(...data.map((d) => d.value), 1);
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return <p className="type-body text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="flex h-40 items-end gap-[3px]">
      {data.map((bar, index) => (
        <div
          key={`${bar.label}-${index}`}
          className="flex h-full flex-1 flex-col justify-end"
          title={bar.title ?? `${bar.label}: ${bar.value}`}
        >
          <div
            className={cn("w-full rounded-t-[4px]", colorClass)}
            style={{
              height: `${Math.max(bar.value === 0 ? 0 : 4, (bar.value / peak) * 100)}%`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

const STATE_SEGMENTS = [
  { key: "new", label: "New", class: "bg-macaw" },
  { key: "learning", label: "Learning", class: "bg-streak" },
  { key: "relearning", label: "Relearning", class: "bg-heart" },
  { key: "review", label: "Review", class: "bg-brand" },
  { key: "suspended", label: "Suspended", class: "bg-border" },
] as const;

export function StateBar({ dist }: { dist: StateDistribution }) {
  if (dist.total === 0) {
    return (
      <p className="type-body text-muted-foreground">
        No cards yet - import a deck to fill this in.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-5 w-full overflow-hidden rounded-full">
        {STATE_SEGMENTS.map((segment) => {
          const value = dist[segment.key];
          if (value === 0) return null;
          return (
            <div
              key={segment.key}
              className={segment.class}
              style={{ width: `${(value / dist.total) * 100}%` }}
              title={`${segment.label}: ${value}`}
            />
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {STATE_SEGMENTS.map((segment) => (
          <li
            key={segment.key}
            className="type-caption flex items-center gap-2 text-muted-foreground"
          >
            <span className={cn("size-3 rounded-full", segment.class)} />
            {segment.label}
            <span className="font-bold text-card-foreground">
              {dist[segment.key]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const RATING_ROWS = [
  { key: "again", label: "Again", class: "bg-heart" },
  { key: "hard", label: "Hard", class: "bg-streak" },
  { key: "good", label: "Good", class: "bg-brand" },
  { key: "easy", label: "Easy", class: "bg-macaw" },
] as const;

export function RatingBars({
  breakdown,
}: {
  breakdown: { again: number; hard: number; good: number; easy: number };
}) {
  const total =
    breakdown.again + breakdown.hard + breakdown.good + breakdown.easy;

  if (total === 0) {
    return (
      <p className="type-body text-muted-foreground">
        Answer a few cards and this fills in.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {RATING_ROWS.map((row) => {
        const value = breakdown[row.key];
        const percent = Math.round((value / total) * 100);
        return (
          <li key={row.key} className="flex items-center gap-3">
            <span className="type-label w-20 shrink-0">{row.label}</span>
            <span className="h-3 flex-1 overflow-hidden rounded-full bg-secondary">
              <span
                className={cn("block h-full rounded-full", row.class)}
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="type-caption w-20 shrink-0 text-right text-muted-foreground">
              {value} ({percent}%)
            </span>
          </li>
        );
      })}
    </ul>
  );
}

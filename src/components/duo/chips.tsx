import type * as React from "react";
import { Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DESIGN.md section 4: pills are radius 9999, padding 6x14, label type, and
 * accent pills carry their own -deep flat drop shadow.
 */
export function Pill({
  className,
  tone = "muted",
  children,
  ...props
}: React.ComponentProps<"span"> & {
  tone?:
    | "muted"
    | "brand"
    | "streak"
    | "heart"
    | "xp"
    | "super"
    | "macaw"
    | "outline";
}) {
  const tones: Record<string, string> = {
    muted: "bg-secondary text-foreground",
    outline: "border-2 border-border bg-card text-muted-foreground",
    brand: "bg-brand text-white",
    streak: "bg-streak text-white",
    heart: "bg-heart text-white",
    xp: "bg-xp text-[#3c3c3c]",
    super: "bg-super text-white",
    macaw: "bg-macaw text-white",
  };

  return (
    <span
      className={cn(
        "type-label inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Section 9: announce the streak in words, not as a bare number. */
export function StreakChip({
  days,
  lit,
  className,
}: {
  days: number;
  lit: boolean;
  className?: string;
}) {
  return (
    <Pill
      tone={lit ? "streak" : "outline"}
      className={cn("gap-1", className)}
      aria-label={`${days} day streak, ${lit ? "lit" : "not lit today"}`}
    >
      <Flame
        className="size-4"
        fill={lit ? "currentColor" : "none"}
        style={
          lit
            ? { animation: "duo-flicker 1.8s ease-in-out infinite" }
            : undefined
        }
      />
      <span aria-hidden="true">{days}</span>
    </Pill>
  );
}

export function XpChip({ xp, className }: { xp: number; className?: string }) {
  return (
    <Pill
      tone="xp"
      className={cn("gap-1", className)}
      aria-label={`${xp} XP earned today`}
    >
      <Zap className="size-4" fill="currentColor" />
      <span aria-hidden="true">{xp}</span>
    </Pill>
  );
}

/** The new / learning / due triple shown on every deck card. */
export function CountPills({
  newDue,
  learningDue,
  reviewDue,
  className,
}: {
  newDue: number;
  learningDue: number;
  reviewDue: number;
  className?: string;
}) {
  const items = [
    { n: newDue, tone: "macaw" as const, label: "new" },
    { n: learningDue, tone: "streak" as const, label: "learning" },
    { n: reviewDue, tone: "brand" as const, label: "to review" },
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {items.map((item) => (
        <Pill
          key={item.label}
          tone={item.n > 0 ? item.tone : "outline"}
          aria-label={`${item.n} ${item.label}`}
        >
          <span aria-hidden="true">
            {item.n} {item.label}
          </span>
        </Pill>
      ))}
    </div>
  );
}

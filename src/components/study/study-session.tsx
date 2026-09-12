"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Home, X } from "lucide-react";
import { Confetti } from "@/components/study/confetti";
import { Mascot } from "@/components/duo/mascot";
import { Pill } from "@/components/duo/chips";
import { Button } from "@/components/ui/button";
import { gradeCardAction } from "@/lib/actions";
import { DECK_COLOR_CLASS, deckColor } from "@/lib/colors";
import type { SessionCard } from "@/lib/queries";
import {
  GRADE_META,
  GRADES,
  previewIntervals,
  STATE_LABEL,
  type Grade,
} from "@/lib/scheduler";
import { XP_PER_REVIEW } from "@/lib/stats-constants";
import { cn } from "@/lib/utils";

interface Props {
  deckId: number;
  deckName: string;
  deckColorName: string;
  frontLang: string;
  backLang: string;
  queue: SessionCard[];
}

interface Progress {
  answered: number;
  again: number;
  /** Wall-clock span from the first card to the most recent answer. */
  elapsedMs: number;
}

/** A card can be replayed a few times in one session; this caps the loop. */
const MAX_REQUEUES = 8;

export function StudySession({
  deckId,
  deckName,
  deckColorName,
  frontLang,
  backLang,
  queue: initialQueue,
}: Props) {
  const router = useRouter();
  const color = DECK_COLOR_CLASS[deckColor(deckColorName)];

  const [queue, setQueue] = useState<SessionCard[]>(initialQueue);
  const [index, setIndex] = useState(0);
  // Keyed by index rather than a boolean, so moving to the next card un-reveals
  // it without an effect that resets state.
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const revealed = revealedIndex === index;
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    answered: 0,
    again: 0,
    elapsedMs: 0,
  });

  const requeues = useRef(new Map<number, number>());
  // Clocks are read in effects and handlers, never during render.
  const startedAt = useRef(0);
  const shownAt = useRef(0);
  const total = initialQueue.length;
  const card = queue[index];
  const finished = !card;

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  const intervals = useMemo(() => {
    if (!card) return null;
    return previewIntervals(card, new Date());
  }, [card]);

  const grade = useCallback(
    async (rating: Grade) => {
      if (!card || pending) return;
      setPending(true);

      const answeredAt = Date.now();
      const durationMs = answeredAt - shownAt.current;
      const result = await gradeCardAction(card.cardId, rating, durationMs);

      setProgress((prev) => ({
        answered: prev.answered + 1,
        again: prev.again + (rating === 1 ? 1 : 0),
        elapsedMs: answeredAt - startedAt.current,
      }));

      if (result.ok && result.requeue) {
        const seen = requeues.current.get(card.cardId) ?? 0;
        if (seen < MAX_REQUEUES) {
          requeues.current.set(card.cardId, seen + 1);
          setQueue((prev) => {
            const next = [...prev];
            const updated: SessionCard = {
              ...card,
              due: result.due ?? card.due,
              state: result.state ?? card.state,
              reps: card.reps + 1,
              lapses: card.lapses + (rating === 1 ? 1 : 0),
              lastReview: Date.now(),
            };
            // Three cards later, so the answer is not still on screen.
            next.splice(Math.min(index + 3, next.length), 0, updated);
            return next;
          });
        }
      }

      setPending(false);
      setIndex((prev) => prev + 1);
    },
    [card, index, pending],
  );

  // Section 9: keyboard order follows visual order, no tab traps.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      if (!revealed && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        setRevealedIndex(index);
        return;
      }
      if (!revealed) return;

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        void grade(3 as Grade);
        return;
      }
      const digit = Number(event.key);
      if (digit >= 1 && digit <= 4) {
        event.preventDefault();
        void grade(digit as Grade);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, grade, index]);

  if (finished) {
    return (
      <SessionComplete
        deckId={deckId}
        deckName={deckName}
        progress={progress}
        onLeave={() => router.push("/")}
      />
    );
  }

  const percent = total === 0 ? 100 : Math.min(100, (index / queue.length) * 100);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center gap-4 px-4 py-4 sm:px-6">
        <Button
          render={<Link href={`/decks/${deckId}`} />}
          variant="ghost"
          size="icon-lg"
          aria-label="Leave this session"
          className="rounded-full"
        >
          <X />
        </Button>

        <div
          className="h-4 flex-1 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={queue.length}
          aria-valuenow={index}
          aria-label="Session progress"
        >
          <div
            className={cn("h-full rounded-full transition-all duration-200", color.bg)}
            style={{ width: `${percent}%` }}
          />
        </div>

        <Pill tone="xp" aria-label={`${progress.answered * XP_PER_REVIEW} XP this session`}>
          <span aria-hidden="true">+{progress.answered * XP_PER_REVIEW}</span>
        </Pill>
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-4 pb-6 sm:px-6">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
          <div className="flex items-center gap-2">
            <Pill tone="outline">{STATE_LABEL[card.state] ?? "New"}</Pill>
            {frontLang ? <Pill tone="outline">{frontLang}</Pill> : null}
          </div>

          <div
            className="flex w-full flex-col items-center gap-6 rounded-[24px] bg-card px-6 py-12 text-center shadow-card"
            aria-live="polite"
          >
            <p className="type-display-lg max-w-full break-words text-balance text-card-foreground max-sm:text-[40px] max-sm:leading-[1.1]">
              {card.front}
            </p>

            {revealed ? (
              <div
                className="flex w-full flex-col items-center gap-4 border-t-2 border-border pt-6"
                style={{ animation: "duo-pop 200ms cubic-bezier(0.34,1.56,0.64,1)" }}
              >
                <p className="type-h2 break-words text-balance text-brand">
                  {card.back}
                </p>
                {card.extra ? (
                  <p className="type-body max-w-[520px] whitespace-pre-line text-muted-foreground">
                    {card.extra}
                  </p>
                ) : null}
                {backLang ? (
                  <span className="type-caption text-muted-foreground">
                    {backLang}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {card.tags.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {card.tags.slice(0, 6).map((tag) => (
                <Pill key={tag} tone="muted">
                  {tag}
                </Pill>
              ))}
            </div>
          ) : null}
        </div>

        {/* Section 10: sticky action zone, thumb-reachable on mobile */}
        <div className="sticky bottom-0 bg-background pt-2 pb-4">
          {revealed ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {GRADES.map((rating) => {
                const meta = GRADE_META[rating];
                return (
                  <Button
                    key={rating}
                    variant={
                      meta.variant as React.ComponentProps<typeof Button>["variant"]
                    }
                    size="duo"
                    disabled={pending}
                    onClick={() => void grade(rating)}
                    className="h-auto flex-col gap-0.5 py-3"
                  >
                    <span>{meta.label}</span>
                    <span className="text-[12px] font-normal tracking-normal opacity-80">
                      {intervals?.[rating]}
                    </span>
                  </Button>
                );
              })}
            </div>
          ) : (
            <Button
              variant="duo"
              size="duo-lg"
              className="w-full"
              onClick={() => setRevealedIndex(index)}
            >
              Show answer
            </Button>
          )}

          <p className="type-caption mt-3 hidden text-center text-muted-foreground sm:block">
            {revealed
              ? "1 Again - 2 Hard - 3 Good - 4 Easy - Space for Good"
              : "Press Space to flip"}
          </p>
        </div>
      </main>
    </div>
  );
}

function SessionComplete({
  deckId,
  deckName,
  progress,
  onLeave,
}: {
  deckId: number;
  deckName: string;
  progress: Progress;
  onLeave: () => void;
}) {
  const minutes = Math.max(1, Math.round(progress.elapsedMs / 60_000));

  const accuracy =
    progress.answered === 0
      ? null
      : Math.round(((progress.answered - progress.again) / progress.answered) * 100);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-8 px-4 text-center">
      {progress.answered > 0 ? <Confetti /> : null}

      <Mascot mood="happy" className="size-40" />

      <div>
        <h1 className="type-h1 text-card-foreground">
          {progress.answered > 0 ? "Lesson complete!" : "Nothing due right now"}
        </h1>
        <p className="type-body-lg mt-2 text-muted-foreground">
          {progress.answered > 0
            ? `${deckName} - see you tomorrow.`
            : "Come back later, or add some cards to this deck."}
        </p>
      </div>

      {progress.answered > 0 ? (
        <div className="grid w-full max-w-[560px] grid-cols-3 gap-3">
          <ResultTile label="Cards" value={String(progress.answered)} tone="macaw" />
          <ResultTile
            label="XP"
            value={`+${progress.answered * XP_PER_REVIEW}`}
            tone="xp"
          />
          <ResultTile
            label="Accuracy"
            value={accuracy === null ? "-" : `${accuracy}%`}
            tone="brand"
          />
          <ResultTile
            label="Minutes"
            value={String(minutes)}
            tone="muted"
            className="col-span-3 sm:col-span-1"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="duo" size="duo-lg" onClick={onLeave}>
          <Home />
          Back to decks
        </Button>
        <Button
          render={<Link href={`/decks/${deckId}`} />}
          variant="duo-secondary"
          size="duo"
        >
          Browse this deck
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function ResultTile({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  tone: "brand" | "xp" | "macaw" | "muted";
  className?: string;
}) {
  const tones = {
    brand: "text-brand",
    xp: "text-xp",
    macaw: "text-macaw",
    muted: "text-muted-foreground",
  } as const;

  return (
    <div
      className={cn("rounded-[20px] bg-card px-4 py-5 shadow-card", className)}
    >
      <p className={cn("type-h2", tones[tone])}>{value}</p>
      <p className="type-caption mt-1 text-muted-foreground">{label}</p>
    </div>
  );
}

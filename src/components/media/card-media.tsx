"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttachedMedia } from "@/lib/media/types";
import { cn } from "@/lib/utils";

/**
 * Images attached to one side of a card. Several pictures sit side by side and
 * wrap; a single one is allowed to grow, because a picture card *is* the card.
 */
export function CardImages({
  media,
  className,
  max = 4,
}: {
  media: AttachedMedia[];
  className?: string;
  /** Height cap in `rem`-ish terms; the card view wants a taller image. */
  max?: number;
}) {
  const images = media.filter((file) => file.kind === "image");
  if (images.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
      {images.map((image) => (
        // Card media is already same-origin, content-addressed and immutably
        // cached, and next/image would want dimensions we do not store.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={image.attachmentId}
          src={image.url}
          alt={image.filename}
          // §6 Large: pictures share the card's own radius family.
          className="max-w-full rounded-[20px] object-contain"
          style={{ maxHeight: `${max * 4}rem` }}
          loading="lazy"
          decoding="async"
        />
      ))}
    </div>
  );
}

/**
 * One speaker button per audio clip. Anki plays a card's sound as soon as the
 * side is shown, so `autoPlay` does the same on mount - browsers that refuse
 * the unprompted playback simply leave the button waiting.
 */
export function CardAudio({
  media,
  autoPlay = false,
  className,
}: {
  media: AttachedMedia[];
  autoPlay?: boolean;
  className?: string;
}) {
  const clips = media.filter((file) => file.kind === "audio");
  if (clips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      {clips.map((clip, index) => (
        <AudioButton
          key={clip.attachmentId}
          clip={clip}
          // Only the first clip of a side plays by itself; the rest are on tap.
          autoPlay={autoPlay && index === 0}
          label={clips.length > 1 ? `Play ${index + 1}` : "Play"}
        />
      ))}
    </div>
  );
}

function AudioButton({
  clip,
  autoPlay,
  label,
}: {
  clip: AttachedMedia;
  autoPlay: boolean;
  label: string;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);

  const play = useCallback(() => {
    const element = audio.current;
    if (!element) return;
    element.currentTime = 0;
    // A rejected promise here is the autoplay policy or a decode failure, and
    // neither should throw into the study session.
    void element.play().catch(() => setPlaying(false));
  }, []);

  useEffect(() => {
    if (autoPlay) play();
  }, [autoPlay, play]);

  return (
    <>
      <Button
        type="button"
        variant="duo-info"
        size="duo"
        disabled={broken}
        onClick={play}
        aria-label={`${label}: ${clip.filename}`}
      >
        <Volume2 className={cn(playing && "motion-safe:animate-pulse")} />
        {label}
      </Button>
      {/* A pronunciation clip has no captions to give; the button above carries
          the accessible name and the controls. */}
      <audio
        ref={audio}
        src={clip.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setBroken(true)}
      />
    </>
  );
}

/**
 * The compact form for list rows: a thumbnail for the first image and a
 * speaker glyph when the field has sound.
 */
export function MediaThumbnails({
  media,
  className,
}: {
  media: AttachedMedia[];
  className?: string;
}) {
  if (media.length === 0) return null;

  const image = media.find((file) => file.kind === "image");
  const audioCount = media.filter((file) => file.kind === "audio").length;

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5", className)}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- see CardImages.
        <img
          src={image.url}
          alt=""
          className="size-8 rounded-lg object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      {audioCount > 0 ? (
        <Volume2
          className="size-4 text-macaw"
          aria-label={`${audioCount} audio clip${audioCount > 1 ? "s" : ""}`}
        />
      ) : null}
    </span>
  );
}

"use client";

import { useMemo } from "react";

const COLORS = [
  "var(--brand)",
  "var(--streak)",
  "var(--xp)",
  "var(--macaw)",
  "var(--super)",
];

/**
 * Deterministic scatter. A seeded hash rather than Math.random keeps the burst
 * pure across renders (and identical between server and client markup).
 */
function noise(seed: number, salt: number): number {
  const x = Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Section 8: celebratory burst on the emphasized (overshoot) easing.
 * Section 9: decorative, so aria-hidden. Section 8 also disables it entirely
 * under prefers-reduced-motion, which the global rule in globals.css handles.
 */
export function Confetti({ pieces = 28 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        const angle = (i / pieces) * Math.PI * 2 + noise(i, 1) * 0.4;
        const distance = 120 + noise(i, 2) * 160;
        return {
          id: i,
          dx: `${Math.cos(angle) * distance}px`,
          dy: `${Math.sin(angle) * distance - 40}px`,
          dr: `${Math.round((noise(i, 3) - 0.5) * 720)}deg`,
          color: COLORS[i % COLORS.length],
          delay: `${Math.round(noise(i, 4) * 120)}ms`,
          size: 6 + Math.round(noise(i, 5) * 8),
          round: i % 3 === 0,
        };
      }),
    [pieces],
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      {bits.map((bit) => (
        <span
          key={bit.id}
          className="absolute"
          style={
            {
              width: bit.size,
              height: bit.size * (bit.round ? 1 : 1.6),
              backgroundColor: bit.color,
              borderRadius: bit.round ? "9999px" : "2px",
              animation: `duo-confetti 600ms cubic-bezier(0.34, 1.56, 0.64, 1) ${bit.delay} forwards`,
              "--dx": bit.dx,
              "--dy": bit.dy,
              "--dr": bit.dr,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

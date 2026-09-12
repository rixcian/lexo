import { cn } from "@/lib/utils";

export type MascotMood = "idle" | "happy" | "thinking" | "sleep";

/**
 * DESIGN.md section 14: "Empty states and 404 pages without a mascot feel
 * sterile." Decorative, so it is hidden from assistive tech (section 9).
 */
export function Mascot({
  mood = "idle",
  className,
  bob = false,
}: {
  mood?: MascotMood;
  className?: string;
  bob?: boolean;
}) {
  const eyeY = mood === "sleep" ? 52 : 53;
  const pupilShift = mood === "thinking" ? 4 : 0;

  return (
    <svg
      viewBox="0 0 120 120"
      className={cn("select-none", className)}
      aria-hidden="true"
      focusable="false"
      style={
        bob ? { animation: "duo-bob 1.6s ease-in-out infinite" } : undefined
      }
    >
      {/* feet */}
      <rect x="38" y="100" width="16" height="12" rx="6" fill="var(--streak)" />
      <rect x="66" y="100" width="16" height="12" rx="6" fill="var(--streak)" />

      {/* wings */}
      <ellipse cx="19" cy="72" rx="11" ry="20" fill="var(--brand-dark)" />
      <ellipse cx="101" cy="72" rx="11" ry="20" fill="var(--brand-dark)" />

      {/* ear tufts */}
      <path d="M28 30 L40 12 L50 32 Z" fill="var(--brand-dark)" />
      <path d="M92 30 L80 12 L70 32 Z" fill="var(--brand-dark)" />

      {/* body */}
      <ellipse cx="60" cy="64" rx="44" ry="42" fill="var(--brand)" />
      <ellipse cx="60" cy="78" rx="30" ry="26" fill="var(--brand-tint)" />

      {/* eye discs */}
      <circle cx="43" cy={eyeY} r="18" fill="#ffffff" />
      <circle cx="77" cy={eyeY} r="18" fill="#ffffff" />
      <circle
        cx="43"
        cy={eyeY}
        r="18"
        fill="none"
        stroke="var(--brand-dark)"
        strokeWidth="3"
      />
      <circle
        cx="77"
        cy={eyeY}
        r="18"
        fill="none"
        stroke="var(--brand-dark)"
        strokeWidth="3"
      />

      {mood === "sleep" ? (
        <>
          <path
            d="M33 53 q10 9 20 0"
            fill="none"
            stroke="#3c3c3c"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M67 53 q10 9 20 0"
            fill="none"
            stroke="#3c3c3c"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx={43 + pupilShift} cy={eyeY} r="7.5" fill="#3c3c3c" />
          <circle cx={77 + pupilShift} cy={eyeY} r="7.5" fill="#3c3c3c" />
          <circle cx={40 + pupilShift} cy={eyeY - 3} r="2.6" fill="#ffffff" />
          <circle cx={74 + pupilShift} cy={eyeY - 3} r="2.6" fill="#ffffff" />
        </>
      )}

      {/* beak */}
      {mood === "happy" ? (
        <path
          d="M50 72 h20 a10 10 0 0 1 -20 0 Z"
          fill="var(--streak)"
          stroke="var(--streak-deep)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M60 68 L70 76 L60 84 L50 76 Z"
          fill="var(--streak)"
          stroke="var(--streak-deep)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

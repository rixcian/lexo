/**
 * Anki convention: the study day rolls over at 04:00 local time, so a late
 * night session still counts towards "yesterday" and does not break a streak.
 */
export const DAY_ROLLOVER_HOUR = 4;

export const DAY_MS = 86_400_000;

/** Start of the study day that `at` falls into. */
export function startOfStudyDay(at: Date | number = new Date()): Date {
  const d = new Date(at);
  const start = new Date(d);
  start.setHours(DAY_ROLLOVER_HOUR, 0, 0, 0);
  if (d.getTime() < start.getTime()) {
    start.setDate(start.getDate() - 1);
  }
  return start;
}

export function endOfStudyDay(at: Date | number = new Date()): Date {
  const start = startOfStudyDay(at);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
}

/** Stable "YYYY-MM-DD" key for the study day, in local time. */
export function studyDayKey(at: Date | number = new Date()): string {
  const start = startOfStudyDay(at);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

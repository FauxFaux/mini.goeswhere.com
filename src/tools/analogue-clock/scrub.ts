import { currentYear, londonTimezone, secondsPerDay } from "./year.ts";

export type StripKind = "day" | "week" | "year";

/** Keep a gesture anchored to its starting day/week, even when it reaches an edge. */
export function scrubSeconds(kind: StripKind, origin: number, progress: number): number {
  const fraction = Math.max(0, Math.min(1, progress));
  if (kind === "year")
    return Math.min(currentYear.seconds - 1, Math.round(fraction * currentYear.seconds));
  const time = currentYear.at(origin);
  const start =
    kind === "week"
      ? time.toPlainDate().subtract({ days: time.dayOfWeek - 1 })
      : time.toPlainDate();
  const span = (kind === "week" ? 7 : 1) * secondsPerDay;
  const wall = Math.min(span - 1, Math.round(fraction * span));
  const date = start.add({ days: Math.floor(wall / secondsPerDay) });
  const withinDay = wall % secondsPerDay;
  const target = date
    .toPlainDateTime({
      hour: Math.floor(withinDay / 3600),
      minute: Math.floor((withinDay % 3600) / 60),
      second: withinDay % 60,
    })
    .toZonedDateTime(londonTimezone);
  const seconds = (target.epochMilliseconds - currentYear.start.epochMilliseconds) / 1000;
  return Math.max(0, Math.min(currentYear.seconds - 1, seconds));
}

export function scrubStep(kind: StripKind): number {
  return kind === "day"
    ? 60 / secondsPerDay
    : kind === "week"
      ? 1 / 7
      : secondsPerDay / currentYear.seconds;
}

import "temporal-polyfill/global";
import { Temporal } from "temporal-polyfill";
import { getSunTimes } from "sunrise-sunset-js/temporal";

export const londonTimezone = "Europe/London";
export const secondsPerDay = 86400;

export function yearTimeline(year: number) {
  const start = Temporal.PlainDate.from({ year, month: 1, day: 1 }).toZonedDateTime(londonTimezone);
  const end = start.add({ years: 1 });
  const seconds = (end.epochMilliseconds - start.epochMilliseconds) / 1000;
  return {
    year,
    start,
    seconds,
    at: (elapsed: number) => start.add({ seconds: elapsed }),
  };
}

const pageLoadTime = Temporal.Now.zonedDateTimeISO(londonTimezone);
export const currentYear = yearTimeline(pageLoadTime.year);
export const initialSeconds = Math.floor(
  (pageLoadTime.epochMilliseconds - currentYear.start.epochMilliseconds) / 1000,
);

export function wrapSeconds(seconds: number): number {
  const rounded = Math.round(seconds);
  return ((rounded % currentYear.seconds) + currentYear.seconds) % currentYear.seconds;
}

export function nowSeconds(): number {
  return wrapSeconds(
    Math.floor(
      (Temporal.Now.instant().epochMilliseconds - currentYear.start.epochMilliseconds) / 1000,
    ),
  );
}

export function localMinutes(seconds: number): number {
  const time = currentYear.at(seconds);
  return time.hour * 60 + time.minute + time.second / 60;
}

export function wallSeconds(time: { hour: number; minute: number; second: number }): number {
  return time.hour * 3600 + time.minute * 60 + time.second;
}

export function sunCycle(date: Temporal.PlainDate) {
  const times = getSunTimes(51.5074, -0.1278, date, { timezoneId: londonTimezone });
  const local = (instant: { epochMilliseconds: number } | null | undefined) =>
    instant
      ? Temporal.Instant.fromEpochMilliseconds(instant.epochMilliseconds).toZonedDateTimeISO(
          londonTimezone,
        )
      : undefined;
  const sunrise = local(times.sunrise);
  const sunset = local(times.sunset);
  const dawn = local(times.twilight?.civilDawn);
  const dusk = local(times.twilight?.civilDusk);
  if (!sunrise || !sunset) throw new Error("Sunrise or sunset is unavailable for London.");
  const sunriseSeconds = wallSeconds(sunrise);
  const sunsetSeconds = wallSeconds(sunset);
  const transitionSeconds = 20 * 60;
  const stops = [
    ["#101a35", 0],
    ["#202c50", wallSeconds(dawn ?? sunrise)],
    ["#b27065", sunriseSeconds],
    ["#efd69a", sunriseSeconds + transitionSeconds],
    ["#efd69a", sunsetSeconds - transitionSeconds],
    ["#b27065", sunsetSeconds],
    ["#202c50", wallSeconds(dusk ?? sunset)],
    ["#101a35", secondsPerDay],
  ] as const;
  return {
    sunrise: sunrise.toPlainTime().toString({ smallestUnit: "minute" }),
    sunset: sunset.toPlainTime().toString({ smallestUnit: "minute" }),
    daylightSeconds: (sunset.epochMilliseconds - sunrise.epochMilliseconds) / 1000,
    gradient: `linear-gradient(to right, ${stops.map(([color, seconds]) => `${color} ${(seconds / secondsPerDay) * 100}%`).join(", ")})`,
  };
}

// Meteorological seasons, blended across the year rather than precise astronomical boundaries.
export function seasonGradient(year: number) {
  const timeline = yearTimeline(year);
  const stops = [
    [1, "#344767"],
    [3, "#54865b"],
    [6, "#dbc274"],
    [9, "#b46d45"],
    [12, "#344767"],
  ] as const;
  const colors = stops.map(([month, color]) => {
    const date = Temporal.PlainDate.from({ year, month, day: 1 }).toZonedDateTime(londonTimezone);
    return `${color} ${((date.epochMilliseconds - timeline.start.epochMilliseconds) / 1000 / timeline.seconds) * 100}%`;
  });
  return `linear-gradient(to right, ${colors.join(", ")}, #344767 100%)`;
}

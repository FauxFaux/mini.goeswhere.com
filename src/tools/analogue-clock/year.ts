import "temporal-polyfill/global";
import { Temporal } from "temporal-polyfill";

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
// Keep the elapsed-seconds epoch stable for existing shared links; display in the selected zone.
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

export function localMinutes(seconds: number, timezone = londonTimezone): number {
  const time = currentYear.at(seconds).withTimeZone(timezone);
  return time.hour * 60 + time.minute + time.second / 60;
}

export function wallSeconds(time: { hour: number; minute: number; second: number }): number {
  return time.hour * 3600 + time.minute * 60 + time.second;
}

export { sunCycle, seasonGradient, timezoneAt } from "../../components/time-strips/gradients.ts";

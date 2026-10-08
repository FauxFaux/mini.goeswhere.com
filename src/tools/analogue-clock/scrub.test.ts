import { Temporal } from "temporal-polyfill";
import { expect, it } from "vitest";
import { scrubSeconds } from "./scrub.ts";
import { currentYear, londonTimezone } from "./year.ts";

const elapsed = (time: Temporal.ZonedDateTime) =>
  (time.epochMilliseconds - currentYear.start.epochMilliseconds) / 1000;

it("scrubs within the selected local day and clamps to its edges", () => {
  const origin = elapsed(currentYear.start.add({ months: 6, days: 10, hours: 15 }));
  const noon = currentYear.at(scrubSeconds("day", origin, 0.5));
  expect(noon.hour).toBe(12);
  expect(noon.toPlainDate().equals(currentYear.at(origin).toPlainDate())).toBe(true);
  expect(currentYear.at(scrubSeconds("day", origin, -1)).hour).toBe(0);
  const end = currentYear.at(scrubSeconds("day", origin, 2));
  expect(end.hour).toBe(23);
  expect(end.minute).toBe(59);
  expect(end.second).toBe(59);
});

it("scrubs local wall time across short and long daylight-saving days", () => {
  for (const [month, hoursToNoon] of [
    [3, 11],
    [10, 13],
  ]) {
    const last = Temporal.PlainDate.from({ year: currentYear.year, month, day: 31 });
    const sunday = last.subtract({ days: last.dayOfWeek % 7 });
    const midnight = sunday.toZonedDateTime(londonTimezone);
    const origin = elapsed(midnight);
    const noon = scrubSeconds("day", origin, 0.5);
    expect(currentYear.at(noon).hour).toBe(12);
    expect(noon - origin).toBe(hoursToNoon * 3600);
  }
});

it("anchors to the same Monday-to-Sunday week and stops at year boundaries", () => {
  const origin = elapsed(currentYear.start.add({ days: 20, hours: 12 }));
  expect(currentYear.at(scrubSeconds("week", origin, 0)).dayOfWeek).toBe(1);
  const sunday = currentYear.at(scrubSeconds("week", origin, 1));
  expect(sunday.dayOfWeek).toBe(7);
  expect(sunday.hour).toBe(23);
  expect(sunday.second).toBe(59);
  expect(scrubSeconds("week", 0, 0)).toBe(0);
  expect(scrubSeconds("week", currentYear.seconds - 1, 1)).toBe(currentYear.seconds - 1);
});

it("maps the year strip to integer seconds and clamps outside drags", () => {
  expect(scrubSeconds("year", 0, -1)).toBe(0);
  expect(scrubSeconds("year", 0, 0.5)).toBe(currentYear.seconds / 2);
  expect(scrubSeconds("year", 0, 2)).toBe(currentYear.seconds - 1);
});

import { Temporal } from "temporal-polyfill";
import { expect, it } from "vitest";
import {
  currentYear,
  initialSeconds,
  localMinutes,
  sunCycle,
  yearTimeline,
  wrapSeconds,
} from "./year.ts";

it("covers ordinary and leap years and wraps at midnight on New Year's Day", () => {
  expect(yearTimeline(2026).seconds).toBe(365 * 86400);
  expect(yearTimeline(2028).seconds).toBe(366 * 86400);
  expect(
    currentYear
      .at(currentYear.seconds - 1)
      .toPlainDate()
      .toString(),
  ).toBe(`${currentYear.year}-12-31`);
  expect(wrapSeconds(currentYear.seconds)).toBe(0);
  expect(wrapSeconds(-1)).toBe(currentYear.seconds - 1);
  expect(localMinutes(0)).toBe(0);
});

it("uses London local time and real elapsed seconds across both daylight-saving changes", () => {
  const year = yearTimeline(2026);
  const beforeSpring = Temporal.ZonedDateTime.from("2026-03-29T00:59:59+00:00[Europe/London]");
  const beforeAutumn = Temporal.ZonedDateTime.from("2026-10-25T01:59:59+01:00[Europe/London]");
  const at = (time: Temporal.ZonedDateTime) =>
    year.at((time.epochMilliseconds - year.start.epochMilliseconds) / 1000 + 1);
  expect(at(beforeSpring).hour).toBe(2);
  expect(at(beforeSpring).offset).toBe("+01:00");
  expect(at(beforeAutumn).hour).toBe(1);
  expect(at(beforeAutumn).offset).toBe("+00:00");
});

it("makes London's summer daylight longer than winter and builds date-specific gradients", () => {
  const summer = sunCycle(Temporal.PlainDate.from("2026-06-21"));
  const winter = sunCycle(Temporal.PlainDate.from("2026-12-21"));
  expect(summer.daylightSeconds).toBeGreaterThan(16 * 3600);
  expect(winter.daylightSeconds).toBeLessThan(9 * 3600);
  expect(summer.sunrise).toMatch(/^04:/);
  expect(summer.sunset).toMatch(/^21:/);
  expect(winter.sunrise).toMatch(/^08:/);
  expect(winter.sunset).toMatch(/^15:/);
  expect(summer.gradient).not.toBe(winter.gradient);
});

it("starts at the current instant on page load, rounded down to integer seconds", () => {
  expect(Number.isInteger(initialSeconds)).toBe(true);
  const elapsedNow =
    (Temporal.Now.instant().epochMilliseconds - currentYear.start.epochMilliseconds) / 1000;
  expect(elapsedNow - initialSeconds).toBeGreaterThanOrEqual(0);
  expect(elapsedNow - initialSeconds).toBeLessThan(10);
});

it("updates sunlight for a different longitude, including daylight across London midnight", () => {
  const date = Temporal.PlainDate.from("2026-06-21");
  const london = sunCycle(date);
  const sydney = sunCycle(date, { latitude: -33.8688, longitude: 151.2093 });
  expect(sydney.sunrise).not.toBe(london.sunrise);
  expect(sydney.daylightSeconds).toBeGreaterThan(9 * 3600);
  expect(sydney.daylightSeconds).toBeLessThan(11 * 3600);
  expect(sydney.gradient).not.toBe(london.gradient);
  expect(sydney.gradient).toMatch(/^linear-gradient\(to right, #efd69a 0%/);
});

it("supports polar day and night without sunrise or sunset", () => {
  const location = { latitude: 90, longitude: 0 };
  const summer = sunCycle(Temporal.PlainDate.from("2026-06-21"), location);
  const winter = sunCycle(Temporal.PlainDate.from("2026-12-21"), location);
  expect(summer.sunrise).toBe("unavailable");
  expect(summer.daylightSeconds).toBe(86400);
  expect(winter.daylightSeconds).toBe(0);
  expect(summer.gradient).toContain("#efd69a 0%");
  expect(winter.gradient).toContain("#101a35 0%");
});

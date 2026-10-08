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

import { Temporal } from "temporal-polyfill";
import { expect, it } from "vitest";
import {
  currentYear,
  initialSeconds,
  localMinutes,
  seasonGradient,
  sunCycle,
  timezoneAt,
  yearTimeline,
  wrapSeconds,
} from "./year.ts";

const seasonColors = (latitude: number, year = 2026) =>
  seasonGradient(year, latitude).match(/#[0-9a-f]{6}/g);

it("keeps the seasonal strip a flat muted yellow only at the equator", () => {
  expect(seasonColors(0)).toEqual(Array(6).fill("#b8ad85"));
  for (const latitude of [-1, 1]) {
    expect(new Set(seasonColors(latitude)).size).toBeGreaterThan(1);
  }
});

it("inverts the seasonal palette in the southern hemisphere and closes the year", () => {
  expect(seasonColors(24)).toEqual([
    "#344767",
    "#54865b",
    "#dbc274",
    "#b46d45",
    "#344767",
    "#344767",
  ]);
  expect(seasonColors(-24)).toEqual([
    "#dbc274",
    "#b46d45",
    "#344767",
    "#54865b",
    "#dbc274",
    "#dbc274",
  ]);
  expect(seasonColors(-90, 2028)).toEqual(seasonColors(-90));
  expect(seasonColors(90)).toEqual(seasonColors(24));
  expect(seasonColors(-90)).toEqual(seasonColors(-24));
});

it("interpolates each colour channel linearly between the equator and 24°", () => {
  for (const hemisphere of [-1, 1]) {
    const temperate = seasonColors(24 * hemisphere)!;
    const midpoint = seasonColors(12 * hemisphere)!;
    for (const [index, color] of midpoint.entries()) {
      for (const offset of [1, 3, 5]) {
        const base = parseInt("#b8ad85".slice(offset, offset + 2), 16);
        const endpoint = parseInt(temperate[index].slice(offset, offset + 2), 16);
        expect(parseInt(color.slice(offset, offset + 2), 16)).toBe(
          Math.round((base + endpoint) / 2),
        );
      }
    }
  }
});

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

it("uses local sunrise, sunset and midnight for a different longitude", () => {
  const date = Temporal.PlainDate.from("2026-06-21");
  const london = sunCycle(date);
  const sydney = sunCycle(date, { latitude: -33.8688, longitude: 151.2093 });
  expect(sydney.sunrise).not.toBe(london.sunrise);
  expect(sydney.daylightSeconds).toBeGreaterThan(9 * 3600);
  expect(sydney.daylightSeconds).toBeLessThan(11 * 3600);
  expect(sydney.gradient).not.toBe(london.gradient);
  expect(sydney.sunrise).toMatch(/^07:/);
  expect(sydney.sunset).toMatch(/^16:/);
  expect(sydney.gradient).toMatch(/^linear-gradient\(to right, #101a35 0%/);
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

it("derives timezones from coordinates and displays the same instant in local time", () => {
  expect(timezoneAt({ latitude: 51.5074, longitude: -0.1278 })).toBe("Europe/London");
  const sydney = timezoneAt({ latitude: -33.8688, longitude: 151.2093 });
  expect(sydney).toBe("Australia/Sydney");
  expect(localMinutes(0, sydney)).toBe(11 * 60);
  const kathmandu = timezoneAt({ latitude: 27.7172, longitude: 85.324 });
  expect(kathmandu).toBe("Asia/Kathmandu");
  expect(localMinutes(0, kathmandu)).toBe(5 * 60 + 45);
});

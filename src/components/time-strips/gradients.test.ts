import { Temporal } from "temporal-polyfill";
import { expect, it } from "vitest";
import { seasonGradient, sunCycle } from "./gradients.ts";

it("places daylight at the observer's longitude on a UTC strip", () => {
  const date = Temporal.PlainDate.from("2026-03-20");
  const greenwich = sunCycle(date, { latitude: 0, longitude: 0 }, "UTC");
  const opposite = sunCycle(date, { latitude: 0, longitude: 180 }, "UTC");
  expect(greenwich.gradient).toContain("#101a35 0%");
  expect(opposite.gradient).toContain("#efd69a 0%");
  expect(greenwich.sunrise).toMatch(/^06:/);
  expect(opposite.sunrise).toMatch(/^18:/);
});

it("samples the same sunlight in UTC and the observer's local timezone", () => {
  const date = Temporal.PlainDate.from("2026-06-21");
  const location = { latitude: -33.8688, longitude: 151.2093 };
  const colors = (gradient: string) => gradient.match(/#[0-9a-f]{6}/g)!;
  const utc = colors(sunCycle(date, location, "UTC").gradient);
  const local = colors(sunCycle(date, location, "Australia/Sydney").gradient);
  expect(utc.slice(0, 57)).toEqual(local.slice(40));
});

it.each([
  ["2026-03-29", "06:", "19:"],
  ["2026-10-25", "06:", "16:"],
])("uses local event times across London's DST change on %s", (day, sunrise, sunset) => {
  const cycle = sunCycle(Temporal.PlainDate.from(day));
  expect(cycle.sunrise).toMatch(new RegExp(`^${sunrise}`));
  expect(cycle.sunset).toMatch(new RegExp(`^${sunset}`));
});

it.each([
  ["2026-06-21", 86400],
  ["2026-12-21", 0],
])("handles polar days without sunrise or sunset on %s", (day, daylightSeconds) => {
  const cycle = sunCycle(Temporal.PlainDate.from(day), { latitude: 89, longitude: 0 }, "UTC");
  expect(cycle.sunrise).toBe("unavailable");
  expect(cycle.sunset).toBe("unavailable");
  expect(cycle.daylightSeconds).toBe(daylightSeconds);
});

it("positions seasonal stops within the selected UTC leap year", () => {
  const gradient = seasonGradient(2024, 51.5, "UTC");
  const march = (60 / 366) * 100;
  expect(gradient).toContain(`#54865b ${march}%`);
  expect(seasonGradient(2024, 0, "UTC").match(/#[0-9a-f]{6}/g)).toEqual(Array(6).fill("#b8ad85"));
  expect(seasonGradient(2024, -51.5, "UTC")).toContain(`#b46d45 ${march}%`);
});

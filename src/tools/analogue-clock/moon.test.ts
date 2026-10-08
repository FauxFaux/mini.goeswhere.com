import { expect, it } from "vitest";
import { londonMoon, moonLitPath, moonProjection } from "./moon.ts";

it("maps the southern sky from east through south to west and horizon to 60°", () => {
  expect(moonProjection(90, 0)).toEqual({ x: 0, y: 1 });
  expect(moonProjection(180, 30)).toEqual({ x: 0.5, y: 0.5 });
  expect(moonProjection(270, 60)).toEqual({ x: 1, y: 0 });
  expect(moonProjection(180, 70).y).toBeLessThan(0);
  expect(moonProjection(180, -1).y).toBeGreaterThan(1);
  expect(moonProjection(180, -30).y).toBe(1.5);
  expect(moonProjection(89, 20).x).toBeLessThan(0);
  expect(moonProjection(271, 20).x).toBeGreaterThan(1);
});

it("calculates a nearly full moon and a nearly new moon from absolute instants", () => {
  const full = londonMoon(new Date("2026-01-03T10:00:00Z"));
  const fresh = londonMoon(new Date("2026-01-18T20:00:00Z"));
  expect(full.fraction).toBeGreaterThan(0.99);
  expect(fresh.fraction).toBeLessThan(0.01);
  expect(full.azimuth).toBeGreaterThanOrEqual(0);
  expect(full.azimuth).toBeLessThan(360);
  expect(Number.isFinite(full.rotation)).toBe(true);
  expect(full.status).toBe("Below the horizon");
});

it("moves the terminator from the dark limb through a half disk to the lit limb", () => {
  expect(moonLitPath(0)).toContain("A 1 1 0 0 0");
  expect(moonLitPath(0.5)).toContain("A 0 1");
  expect(moonLitPath(1)).toContain("A 1 1 0 0 1");
});

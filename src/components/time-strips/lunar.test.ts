import { getMoonIllumination } from "suncalc";
import { expect, it } from "vitest";
import { fullMoonProgress, lunarCycle, lunarGradient } from "./lunar.ts";

const dayMs = 86400000;

it("finds the surrounding new moons across the supported date range", () => {
  for (const date of ["1900-01-01", "2024-02-29", "2026-10-09", "2099-12-31"]) {
    const instant = Date.parse(date);
    const { start, span } = lunarCycle(instant);
    expect(start).toBeLessThanOrEqual(instant);
    expect(start + span).toBeGreaterThan(instant);
    expect(span / dayMs).toBeGreaterThan(29);
    expect(span / dayMs).toBeLessThan(30);
    expect(getMoonIllumination(new Date(start - 1)).phase).toBeGreaterThan(0.99);
    expect(getMoonIllumination(new Date(start)).phase).toBeLessThan(0.01);
    expect(lunarCycle(start)).toEqual({ start, span });
    expect(lunarCycle(start + span - 1000)).toEqual({ start, span });
    expect(lunarCycle(start + span).start).toBe(start + span);
  }
});

it("samples illumination from dark new moons through a bright full moon", () => {
  const { start, span } = lunarCycle(Date.parse("2026-10-09"));
  const shades = lunarGradient(start, span).match(/#[0-9a-f]{6}/g)!;
  expect(shades).toHaveLength(97);
  const brightness = shades.map((color) => parseInt(color.slice(1, 3), 16));
  expect(brightness[0]).toBeLessThan(27);
  expect(brightness[96]).toBeLessThan(27);
  expect(Math.max(...brightness)).toBeGreaterThan(228);
  const full = fullMoonProgress(start, span);
  expect(full).toBeGreaterThan(0.4);
  expect(full).toBeLessThan(0.6);
  expect(getMoonIllumination(new Date(start + span * full)).fraction).toBeGreaterThan(0.99);
});

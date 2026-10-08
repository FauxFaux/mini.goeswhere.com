import { expect, it } from "vitest";
import { isInNewZealandCutout, newZealandCutoutBoundary } from "./new-zealand-cutout.ts";
import { locationToPoint } from "./projection.ts";

it.each([
  [-34.4, 173], // North Cape
  [-36.85, 174.76], // Auckland
  [-41.29, 174.78], // Wellington
  [-43.53, 172.64], // Christchurch
  [-45.9, 170.5], // Dunedin
  [-46.7, 167.7], // southwest South Island
  [-47.3, 167.9], // Stewart Island
])("covers New Zealand at %s, %s", (latitude, longitude) => {
  expect(isInNewZealandCutout(...locationToPoint({ latitude, longitude }))).toBe(true);
});

it.each([
  [-28.64, 153.64], // easternmost mainland Australia
  [-33.87, 151.21], // Sydney
  [-37.5, 149.98], // southeast mainland
  [-43.64, 146.83], // southern Tasmania
  [-40.99, 148.35], // eastern Tasmania
])("leaves Australia visible at %s, %s", (latitude, longitude) => {
  expect(isInNewZealandCutout(...locationToPoint({ latitude, longitude }))).toBe(false);
});

it("includes the smooth boundary and excludes pixels just outside it", () => {
  for (const y of [280, 420, 600, 750, 900]) {
    const x = newZealandCutoutBoundary(y);
    expect(isInNewZealandCutout(x, y)).toBe(true);
    expect(isInNewZealandCutout(x - 0.01, y)).toBe(false);
  }
});

it("sweeps through the eastern lobe into Antarctica", () => {
  expect(isInNewZealandCutout(2030, 350)).toBe(true);
  expect(isInNewZealandCutout(1950, 650)).toBe(true);
  expect(isInNewZealandCutout(1800, 800)).toBe(true);
  expect(isInNewZealandCutout(1700, 880)).toBe(true);
  expect(isInNewZealandCutout(2030, 279)).toBe(false);
});

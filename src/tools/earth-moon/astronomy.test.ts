import { describe, expect, it } from "vitest";
import { getMoonPosition, getPosition } from "suncalc";
import { SphereGeometry, Vector3 } from "three";
import {
  dayMs,
  dot,
  earthMoonSnapshot,
  geometricAltitude,
  horizontalDirection,
  lunarOrbit,
  moonEarthPosition,
  observerFrame,
  scale,
  unit,
} from "./astronomy.ts";

describe("Earth-fixed coordinates and tangent horizons", () => {
  it("aligns dateline-starting texture UVs with geographic coordinates", () => {
    const sphere = new SphereGeometry(1, 64, 32);
    const positions = sphere.getAttribute("position");
    const uvs = sphere.getAttribute("uv");
    // Skip poles: the UV seam's pole offset is deliberate in SphereGeometry.
    for (let i = 0; i < positions.count; i++) {
      const position = new Vector3().fromBufferAttribute(positions, i);
      if (Math.abs(position.y) > 0.999) continue;
      const location = { longitude: uvs.getX(i) * 360 - 180, latitude: uvs.getY(i) * 180 - 90 };
      expect(position.distanceTo(new Vector3(...observerFrame(location).up))).toBeLessThan(1e-6);
    }
    sphere.dispose();
  });

  it.each([
    { latitude: 0, longitude: 0 },
    { latitude: 90, longitude: 180 },
    { latitude: -90, longitude: -180 },
    { latitude: -33.86, longitude: 151.2 },
  ])("builds a unit orthogonal horizon even at the poles: %j", (location) => {
    const { up, north, east } = observerFrame(location);
    expect(dot(up, north)).toBeCloseTo(0, 12);
    expect(dot(up, east)).toBeCloseTo(0, 12);
    expect(dot(north, east)).toBeCloseTo(0, 12);
    for (const v of [up, north, east]) expect(Math.hypot(...v)).toBeCloseTo(1, 12);
    expect(dot(horizontalDirection(location, 35, 0), up)).toBeCloseTo(0, 12);
    expect(dot(horizontalDirection(location, 35, 90), up)).toBeCloseTo(1, 12);
  });
});

it("reconstructs SunCalc bearings and geometric heights across locations, dates and horizons", () => {
  for (let day = 0; day < 30; day += 3) {
    for (const hour of [0, 6, 12, 18]) {
      const date = new Date(Date.UTC(2026, 9, 1, hour) + day * dayMs);
      for (const location of [
        { latitude: 51.5, longitude: -0.1 },
        { latitude: -33.9, longitude: 151.2 },
        { latitude: 0, longitude: -180 },
        { latitude: 90, longitude: 0 },
        { latitude: -90, longitude: 20 },
      ]) {
        const result = earthMoonSnapshot(date, location);
        const observed = getMoonPosition(date, location.latitude, location.longitude);
        const expected = horizontalDirection(
          location,
          observed.azimuth,
          geometricAltitude(observed.altitude),
        );
        // SunCalc uses a first-order parallax correction; subtracting the observer vector
        // gives exact spherical geometry. Their discrepancy is under 0.01°.
        expect(dot(result.sight, expected)).toBeGreaterThan(Math.cos((0.01 * Math.PI) / 180));
        expect(Math.hypot(...result.moonPosition)).toBeCloseTo(observed.distance / 6378.14, 9);
        const sun = getPosition(date, location.latitude, location.longitude);
        const expectedSun = horizontalDirection(
          location,
          sun.azimuth,
          geometricAltitude(sun.altitude),
        );
        expect(dot(result.sunDirection, expectedSun)).toBeCloseTo(1, 10);
      }
    }
  }
});

it("undoes refraction above and below the horizon", () => {
  for (const geometric of [-85, -10, -0.5, 0, 0.5, 10, 70, 89.9]) {
    const h = Math.max(0, (geometric * Math.PI) / 180);
    const apparent =
      geometric + ((0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179))) * 180) / Math.PI;
    expect(geometricAltitude(apparent)).toBeCloseTo(geometric, 10);
  }
});

it("shows a lunar orbit rather than Earth's daily apparent rotation", () => {
  const date = new Date("2026-10-09T12:00:00Z");
  const path = lunarOrbit(date);
  expect(path).toHaveLength(113);
  expect(path[56]).toEqual(moonEarthPosition(date));
  for (let i = 1; i < path.length; i++) {
    expect(dot(unit(path[i]), unit(path[i - 1]))).toBeGreaterThan(Math.cos((5 * Math.PI) / 180));
    expect(Math.hypot(...path[i])).toBeGreaterThan(55);
    expect(Math.hypot(...path[i])).toBeLessThan(65);
  }
  expect(dot(unit(path[0]), unit(path[56]))).toBeLessThan(-0.8);
});

it("lights the correct lunar hemisphere through the phase cycle", () => {
  for (let i = 0; i < 30; i++) {
    const result = earthMoonSnapshot(new Date(Date.UTC(2026, 9, 1) + i * dayMs), {
      latitude: 0,
      longitude: 0,
    });
    const earthFromMoon = scale(unit(result.moonPosition), -1);
    const fraction = (1 + dot(earthFromMoon, result.sunDirection)) / 2;
    expect(fraction).toBeCloseTo(result.illumination.fraction, 2);
  }
});

it("freezes daily sunlight rotation while preserving lunar phases and orbit geometry", () => {
  const start = Date.parse("2026-10-09T12:00:00Z");
  const location = { latitude: 51.5, longitude: -0.1 };
  const initial = earthMoonSnapshot(new Date(start), location);
  for (const days of [0.25, 0.5, 1, 3]) {
    const date = new Date(start + days * dayMs);
    const normal = earthMoonSnapshot(date, location);
    const frozen = earthMoonSnapshot(date, location, days);
    expect(dot(initial.sunDirection, frozen.sunDirection)).toBeGreaterThan(0.999);
    expect(frozen.illumination).toEqual(normal.illumination);
    expect(Math.hypot(...frozen.moonPosition)).toBeCloseTo(Math.hypot(...normal.moonPosition), 10);
    expect(lunarOrbit(date, days)[56]).toEqual(frozen.moonPosition);
    const expected = horizontalDirection(
      location,
      frozen.moon.azimuth,
      geometricAltitude(frozen.moon.altitude),
    );
    expect(dot(frozen.sight, expected)).toBeGreaterThan(Math.cos((0.01 * Math.PI) / 180));
  }
  const halfDay = earthMoonSnapshot(new Date(start + dayMs / 2), location);
  expect(dot(initial.sunDirection, halfDay.sunDirection)).toBeLessThan(-0.9);
});

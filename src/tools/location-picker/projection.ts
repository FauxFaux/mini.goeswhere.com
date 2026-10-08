import { homolosineForward, homolosineInverse, poleY } from "./homolosine.ts";

export interface Location {
  latitude: number;
  longitude: number;
}

export const MAP_WIDTH = 2058;
export const MAP_HEIGHT = 900;

// The supplied raster has its equator at y=450, spanning x=8 to x=2050.
// D3's default six lobes match its cuts at -40° north and -100°/-20°/80° south.
// Calibrate to the equator rather than fitting the image's padded rectangle.
const scale = (2050 - 8) / (2 * Math.PI);
const radians = Math.PI / 180;

// Lobe limits and central meridians, adapted from D3's interrupted/homolosine.js.
// Copyright 2013-2021 Mike Bostock. ISC license: see projection-license.txt.
const northLobes = [
  { west: -180, center: -100, east: -40 },
  { west: -40, center: 30, east: 180 },
];
const southLobes = [
  { west: -180, center: -160, east: -100 },
  { west: -100, center: -60, east: -20 },
  { west: -20, center: 20, east: 80 },
  { west: 80, center: 140, east: 180 },
];

export function isLocation(value: Location): boolean {
  return (
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180
  );
}

export function locationToPoint(location: Location): [number, number] {
  const lobes = location.latitude < 0 ? southLobes : northLobes;
  const lobe = lobes.find((candidate) => location.longitude <= candidate.east)!;
  const [x, y] = homolosineForward(
    (location.longitude - lobe.center) * radians,
    location.latitude * radians,
  );
  return [1029 + scale * (x + lobe.center * radians), 450 - scale * y];
}

export function pointToLocation(x: number, y: number): Location | null {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > MAP_WIDTH ||
    y < 0 ||
    y > MAP_HEIGHT
  ) {
    return null;
  }
  const rawX = (x - 1029) / scale;
  const rawY = (450 - y) / scale;
  if (Math.abs(rawY) > poleY + 1e-12) return null;
  const lobes = rawY < 0 ? southLobes : northLobes;
  for (const lobe of lobes) {
    const localX = rawX - lobe.center * radians;
    // Longitude is indeterminate at a pole; choose this lobe's central meridian.
    const atPole = Math.abs(Math.abs(rawY) - poleY) < 1e-12;
    if (atPole && Math.abs(localX) > 1e-10) continue;
    const [longitude, latitude] = atPole
      ? [0, (Math.sign(rawY) * Math.PI) / 2]
      : homolosineInverse(localX, rawY);
    const degreesLongitude = longitude / radians + lobe.center;
    if (degreesLongitude < lobe.west - 1e-9 || degreesLongitude > lobe.east + 1e-9) continue;
    const location = {
      longitude: Math.max(lobe.west, Math.min(lobe.east, degreesLongitude)),
      latitude: latitude / radians,
    };
    if (!isLocation(location)) continue;
    // Inversion must land back on the same lobe, never across a black interruption.
    const point = locationToPoint(location);
    if (Math.hypot(point[0] - x, point[1] - y) <= 0.01) return location;
  }
  return null;
}

export function roundLocation(location: Location): Location {
  return {
    latitude: Number(location.latitude.toFixed(6)),
    longitude: Number(location.longitude.toFixed(6)),
  };
}

export function moveLocation(location: Location, longitude: number, latitude: number): Location {
  const nextLongitude = location.longitude + longitude;
  return roundLocation({
    latitude: Math.max(-90, Math.min(90, location.latitude + latitude)),
    longitude: ((((nextLongitude + 180) % 360) + 360) % 360) - 180,
  });
}

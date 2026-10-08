import { geoInterruptedHomolosine } from "d3-geo-projection";

export interface Location {
  latitude: number;
  longitude: number;
}

export const MAP_WIDTH = 2058;
export const MAP_HEIGHT = 900;

// The supplied raster has its equator at y=450, spanning x=8 to x=2050.
// D3's default six lobes match its cuts at -40° north and -100°/-20°/80° south.
// Calibrate to the equator rather than fitting the image's padded rectangle.
const projection = geoInterruptedHomolosine()
  .scale((2050 - 8) / (2 * Math.PI))
  .translate([1029, 450]);

export function isLocation(value: Location): boolean {
  return (
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180
  );
}

export function locationToPoint(location: Location): [number, number] {
  return projection([location.longitude, location.latitude])!;
}

export function pointToLocation(x: number, y: number): Location | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > MAP_WIDTH || y < 0 || y > MAP_HEIGHT) {
    return null;
  }
  const coordinates = projection.invert!([x, y]);
  if (!coordinates) return null;
  const location = { longitude: coordinates[0], latitude: coordinates[1] };
  if (!isLocation(location)) return null;
  // Inversion must land back on the same lobe, never across a black interruption.
  const point = locationToPoint(location);
  if (Math.hypot(point[0] - x, point[1] - y) > 0.01) return null;
  return location;
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
    longitude: ((nextLongitude + 180) % 360 + 360) % 360 - 180,
  });
}

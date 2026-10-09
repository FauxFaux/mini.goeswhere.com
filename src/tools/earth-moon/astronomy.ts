import { getMoonIllumination, getMoonPosition, getPosition } from "suncalc";
import type { Location } from "../../components/location-picker/projection.ts";

export type Vector = [number, number, number];
export const earthRadiusKm = 6378.14;
export const moonRadiusKm = 1737.4;
export const dayMs = 86400000;
const rad = Math.PI / 180;

export const add = (a: Vector, b: Vector): Vector => a.map((v, i) => v + b[i]) as Vector;
export const scale = (a: Vector, s: number): Vector => a.map((v) => v * s) as Vector;
export const dot = (a: Vector, b: Vector) => a.reduce((sum, v, i) => sum + v * b[i], 0);
export const unit = (a: Vector) => scale(a, 1 / Math.hypot(...a));

/** Earth-fixed, right-handed frame: +Y north, +X Greenwich, −Z 90° east.
 * This also matches Three.js SphereGeometry's usual equirectangular UV orientation. */
export function observerFrame({ latitude, longitude }: Location) {
  const phi = latitude * rad;
  const lambda = longitude * rad;
  return {
    up: [
      Math.cos(phi) * Math.cos(lambda),
      Math.sin(phi),
      -Math.cos(phi) * Math.sin(lambda),
    ] as Vector,
    north: [
      -Math.sin(phi) * Math.cos(lambda),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(lambda),
    ] as Vector,
    east: [-Math.sin(lambda), 0, -Math.cos(lambda)] as Vector,
  };
}

export function horizontalDirection(location: Location, bearing: number, altitude: number): Vector {
  const { up, north, east } = observerFrame(location);
  return add(
    scale(up, Math.sin(altitude * rad)),
    add(
      scale(north, Math.cos(altitude * rad) * Math.cos(bearing * rad)),
      scale(east, Math.cos(altitude * rad) * Math.sin(bearing * rad)),
    ),
  );
}

/** Invert SunCalc 2's Meeus refraction model, including its below-horizon clamp.
 * Spatial geometry needs geometric altitude; the readout keeps apparent altitude. */
export function geometricAltitude(apparentDegrees: number) {
  let low = -Math.PI / 2;
  let high = Math.PI / 2;
  for (let i = 0; i < 55; i++) {
    const mid = (low + high) / 2;
    const h = Math.max(0, mid);
    const refraction = 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
    if (mid + refraction < apparentDegrees * rad) low = mid;
    else high = mid;
  }
  return (low + high) / (2 * rad);
}

/** Recover a geocentric Moon position from SunCalc's topocentric horizontal API.
 * Use one fixed reference observer so changing GPS cannot move the Moon's orbit.
 * SunCalc 2 subtracts asin(R / distance * cos(hGeo)) from geocentric altitude. */
export function moonEarthPosition(date: Date): Vector {
  const reference = { latitude: 0, longitude: 0 };
  const moon = getMoonPosition(date, 0, 0);
  const h = geometricAltitude(moon.altitude) * rad;
  let low = -Math.PI / 2;
  let high = Math.PI / 2;
  for (let i = 0; i < 55; i++) {
    const mid = (low + high) / 2;
    if (mid - Math.asin((earthRadiusKm / moon.distance) * Math.cos(mid)) < h) low = mid;
    else high = mid;
  }
  return scale(
    horizontalDirection(reference, moon.azimuth, (low + high) / (2 * rad)),
    moon.distance / earthRadiusKm,
  );
}

export function sunEarthDirection(date: Date): Vector {
  const sun = getPosition(date, 0, 0);
  return horizontalDirection(
    { latitude: 0, longitude: 0 },
    sun.azimuth,
    geometricAltitude(sun.altitude),
  );
}

/** A 28-day ephemeris trail in the selected instant's Earth orientation.
 * Undo Earth rotation at each sample, otherwise a lunar orbit becomes daily loops.
 * It is a sampled path, not a closed Keplerian ellipse. */
export function lunarOrbit(date: Date, frozenDays = 0): Vector[] {
  return Array.from({ length: 113 }, (_, i) => {
    const offsetDays = (i - 56) / 4;
    const point = moonEarthPosition(new Date(date.getTime() + offsetDays * dayMs));
    const angle = (offsetDays * 360.98564736629 + frozenDays * 360) * rad;
    return [
      point[0] * Math.cos(angle) + point[2] * Math.sin(angle),
      point[1],
      -point[0] * Math.sin(angle) + point[2] * Math.cos(angle),
    ];
  });
}

/** Cancel solar-day rotation during fast playback while retaining orbital/seasonal motion. */
export function earthMoonSnapshot(date: Date, location: Location, frozenDays = 0) {
  const longitude = location.longitude - frozenDays * 360;
  const moon = getMoonPosition(date, location.latitude, longitude);
  const sun = getPosition(date, location.latitude, longitude);
  const frame = observerFrame(location);
  const rotate = (point: Vector): Vector => {
    const angle = frozenDays * 360 * rad;
    return [
      point[0] * Math.cos(angle) + point[2] * Math.sin(angle),
      point[1],
      -point[0] * Math.sin(angle) + point[2] * Math.cos(angle),
    ];
  };
  const moonPosition = rotate(moonEarthPosition(date));
  const sight = unit(add(moonPosition, scale(frame.up, -1)));
  return {
    frame,
    moon,
    sun,
    moonPosition,
    sight,
    sunDirection: rotate(sunEarthDirection(date)),
    illumination: getMoonIllumination(date),
    geometricMoonAltitude: Math.asin(Math.max(-1, Math.min(1, dot(sight, frame.up)))) / rad,
  };
}

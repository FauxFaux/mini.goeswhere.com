import { getMoonIllumination, getMoonPosition } from "suncalc";

/** Facing south: east to west horizontally, horizon to 60° vertically. */
export function moonProjection(azimuth: number, altitude: number) {
  return {
    x: (azimuth - 90) / 180,
    y: 1 - altitude / 60,
  };
}

export function londonMoon(date: Date) {
  const position = getMoonPosition(date, 51.5074, -0.1278);
  const illumination = getMoonIllumination(date);
  return {
    ...position,
    ...illumination,
    ...moonProjection(position.azimuth, position.altitude),
    rotation: position.parallacticAngle - illumination.angle - 90,
    status:
      position.altitude < 0
        ? "Below the horizon"
        : position.azimuth < 90 || position.azimuth > 270
          ? "Outside the southern view"
          : "In the southern sky",
  };
}

/** Unit disk's lit right limb, bounded by an elliptical terminator. */
export function moonLitPath(fraction: number) {
  const terminator = 1 - 2 * fraction;
  return `M 0 -1 A 1 1 0 0 1 0 1 A ${Math.abs(terminator)} 1 0 0 ${terminator > 0 ? 0 : 1} 0 -1 Z`;
}

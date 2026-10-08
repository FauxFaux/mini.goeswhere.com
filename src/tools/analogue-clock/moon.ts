import { getMoonIllumination, getMoonPosition, getMoonTimes } from "suncalc";

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

/** Nearby upper transits, used to select one lunar pass rather than two calendar-day fragments. */
export function moonTransits(date: Date) {
  const transits: number[] = [];
  for (const offset of [-1, 0, 1]) {
    const transit = getMoonTimes(
      new Date(date.getTime() + offset * 86400000),
      51.5074,
      -0.1278,
      0,
    ).transit;
    if (transit) transits.push(transit.getTime());
  }
  return transits;
}

/** One 24-hour window centered on an upper transit, sampled every half hour. */
export function moonTrail(transitMilliseconds: number) {
  const samples = [];
  const halfWindow = 12 * 60 * 60 * 1000;
  for (
    let instant = transitMilliseconds - halfWindow;
    instant < transitMilliseconds + halfWindow;
    instant += 30 * 60 * 1000
  ) {
    samples.push({ instant, ...londonMoon(new Date(instant)) });
  }
  return samples;
}

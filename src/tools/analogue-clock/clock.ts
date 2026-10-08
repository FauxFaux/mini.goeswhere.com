export type Hand = "hour" | "minute";
export interface Point {
  x: number;
  y: number;
}

export const handLengths: Record<Hand, number> = { hour: 132, minute: 194 };

export function wrapMinutes(minutes: number): number {
  return ((minutes % 720) + 720) % 720;
}

export function handAngle(minutes: number, hand: Hand): number {
  return hand === "hour" ? minutes / 2 : (minutes % 60) * 6;
}

/** Clockwise degrees from twelve, using coordinates relative to the pivot. */
export function pointerAngle(point: Point): number {
  return (Math.atan2(point.x, -point.y) * 180) / Math.PI;
}

/** Keep a crossing of twelve continuous in either direction. */
export function angleDelta(previous: number, next: number): number {
  return ((next - previous + 540) % 360) - 180;
}

export function turnHand(minutes: number, hand: Hand, degrees: number): number {
  return wrapMinutes(minutes + degrees * (hand === "hour" ? 2 : 1 / 6));
}

export function pointOnClock(degrees: number, radius: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: Math.sin(radians) * radius, y: -Math.cos(radians) * radius };
}

function distanceToHand(point: Point, minutes: number, hand: Hand): number {
  const end = pointOnClock(handAngle(minutes, hand), handLengths[hand]);
  const fraction = Math.max(
    0,
    Math.min(1, (point.x * end.x + point.y * end.y) / handLengths[hand] ** 2),
  );
  return Math.hypot(point.x - fraction * end.x, point.y - fraction * end.y);
}

/** Prefer the closest hand target, then a 90° sector centred on each hand.
 * The minute hand wins equal-distance targets and overlapping fallback sectors.
 */
export function pickHand(point: Point, minutes: number, tolerance: number): Hand | undefined {
  const radius = Math.hypot(point.x, point.y);
  if (radius < 24) return undefined;
  const hourDistance = distanceToHand(point, minutes, "hour");
  const minuteDistance = distanceToHand(point, minutes, "minute");
  if (Math.min(hourDistance, minuteDistance) <= tolerance) {
    return minuteDistance <= hourDistance + 0.001 ? "minute" : "hour";
  }
  if (radius > 239) return undefined;
  const angle = pointerAngle(point);
  const inSector = (hand: Hand) =>
    Math.abs(angleDelta(handAngle(minutes, hand), angle)) <= 45 + 1e-9;
  if (inSector("minute")) return "minute";
  if (inSector("hour")) return "hour";
  return undefined;
}

import { getMoonIllumination } from "suncalc";

const dayMs = 86400000;
const phaseAt = (instant: number) => getMoonIllumination(new Date(instant)).phase;

/** Locate the first millisecond after the phase wraps from waning to waxing. */
function newMoonBetween(before: number, after: number): number {
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (phaseAt(middle) > 0.5) before = middle;
    else after = middle;
  }
  return after;
}

function adjacentNewMoon(instant: number, direction: -1 | 1): number {
  let previous = instant;
  let previousPhase = phaseAt(previous);
  for (let day = 1; day <= 35; day++) {
    const next = instant + direction * day * dayMs;
    const nextPhase = phaseAt(next);
    if (direction === 1 ? nextPhase < previousPhase : nextPhase > previousPhase)
      return direction === 1 ? newMoonBetween(previous, next) : newMoonBetween(next, previous);
    previous = next;
    previousPhase = nextPhase;
  }
  throw new Error("Could not find the surrounding lunar cycle.");
}

export function lunarCycle(instant: number) {
  const start = adjacentNewMoon(instant, -1);
  const end = adjacentNewMoon(instant, 1);
  // At the new-moon boundary itself, the backward search finds that same instant.
  const span = end - start;
  return { start, span };
}

export function lunarGradient(start: number, span: number) {
  const stops = Array.from({ length: 97 }, (_, index) => {
    const fraction = getMoonIllumination(new Date(start + (span * index) / 96)).fraction;
    const shade = Math.round(24 + fraction * 208)
      .toString(16)
      .padStart(2, "0");
    return `#${shade.repeat(3)} ${(index / 96) * 100}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function fullMoonProgress(start: number, span: number): number {
  let before = start;
  let after = start + span - 1;
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (phaseAt(middle) < 0.5) before = middle;
    else after = middle;
  }
  return (after - start) / span;
}

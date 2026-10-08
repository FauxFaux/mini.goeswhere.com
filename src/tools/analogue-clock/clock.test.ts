import { describe, expect, it } from "vitest";
import { angleDelta, handAngle, pickHand, pointOnClock, pointerAngle, turnHand } from "./clock.ts";

describe("clock motion", () => {
  it("moves both hands as a clock, including fractional hours", () => {
    expect(handAngle(90, "hour")).toBe(45);
    expect(handAngle(90, "minute")).toBe(180);
    expect(turnHand(90, "minute", 360)).toBe(150);
    expect(turnHand(90, "hour", 30)).toBe(150);
    expect(turnHand(90, "hour", 15)).toBe(120);
  });

  it("crosses twelve and wraps the time in both directions", () => {
    expect(angleDelta(354, 6)).toBe(12);
    expect(angleDelta(6, 354)).toBe(-12);
    expect(angleDelta(179, -179)).toBe(2);
    expect(angleDelta(-179, 179)).toBe(-2);
    expect(turnHand(719, "minute", 12)).toBe(1);
    expect(turnHand(1, "minute", -12)).toBe(719);
  });

  it("uses clockwise angles from twelve", () => {
    for (const angle of [0, 90, 179, -90]) {
      expect(pointerAngle(pointOnClock(angle, 150))).toBeCloseTo(angle);
    }
  });

  it("offers generous targets and makes both overlapping hands reachable", () => {
    expect(pickHand({ x: 25, y: -100 }, 0, 28)).toBe("minute");
    expect(pickHand({ x: 0, y: -194 }, 0, 28)).toBe("minute");
    expect(pickHand({ x: 0, y: -132 }, 0, 28)).toBe("minute");
    expect(pickHand({ x: 0, y: 0 }, 0, 28)).toBeUndefined();
    expect(pickHand({ x: 150, y: 100 }, 0, 28)).toBeUndefined();
    expect(pickHand(pointOnClock(60, 180), 610, 28)).toBe("minute");
  });

  it("extends each hand's target to a quarter of the face", () => {
    for (const angle of [-45, 45]) {
      expect(pickHand(pointOnClock(angle, 230), 180, 28)).toBe("minute");
    }
    for (const angle of [70, 100, 135]) {
      expect(pickHand(pointOnClock(angle, 230), 180, 28)).toBe("hour");
    }
    expect(pickHand(pointOnClock(-46, 230), 180, 28)).toBeUndefined();
    expect(pickHand(pointOnClock(136, 230), 180, 28)).toBeUndefined();
    expect(pickHand(pointOnClock(20, 250), 180, 28)).toBeUndefined();
  });

  it("prefers a close hour target over the minute fallback, but defaults sector conflicts to minutes", () => {
    expect(pickHand(pointOnClock(30, 120), 60, 28)).toBe("hour");
    expect(pickHand(pointOnClock(20, 230), 60, 28)).toBe("minute");
    expect(pickHand(pointOnClock(40, 230), 0, 28)).toBe("minute");
    expect(pickHand(pointOnClock(-30, 230), 710, 28)).toBe("minute");
  });
});

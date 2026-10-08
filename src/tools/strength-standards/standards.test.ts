import { describe, expect, it } from "vitest";
import { formatWeight, interpolateStandards, standards } from "./standards.ts";

describe("strength standards data", () => {
  it("includes all five activities with the source's bodyweight rows", () => {
    expect(standards.map((activity) => activity.id)).toEqual([
      "press",
      "bench-press",
      "squat",
      "deadlift",
      "power-clean",
    ]);
    for (const activity of standards) {
      expect(activity.men.map((row) => row[0])).toEqual([
        114, 123, 132, 148, 165, 181, 198, 220, 242, 275, 319, 320,
      ]);
      expect(activity.women.map((row) => row[0])).toEqual([
        97, 105, 114, 123, 132, 148, 165, 181, 198, 199,
      ]);
    }
  });

  it("retains the PDF's press values for 165 and 181 lb men", () => {
    expect(standards[0].men.find((row) => row[0] === 165)?.[3]).toBe(129);
    expect(standards[0].men.find((row) => row[0] === 181)?.[3]).toBe(138);
  });

  it("converts bodyweights and lift weights to kg without rounding to plate increments", () => {
    expect(formatWeight(165, "kg")).toBe("74.8");
    expect(formatWeight(129, "kg")).toBe("58.5");
    expect(formatWeight(320, "kg")).toBe("145.1");
    expect(formatWeight(129, "lb")).toBe("129");
  });

  it("returns every exact row unchanged", () => {
    for (const activity of standards) {
      for (const rows of [activity.men, activity.women]) {
        for (const row of rows) expect(interpolateStandards(rows, row[0])).toEqual(row);
      }
    }
  });

  it("interpolates each category using its adjacent bodyweight interval", () => {
    expect(interpolateStandards(standards[0].men, 173)).toEqual([173, 78, 106, 133.5, 158.5, 202]);
    const result = interpolateStandards(standards[0].men, 169)!;
    expect(result).toEqual([169, 76.5, 104, 131.25, 155.75, 194]);
    expect(formatWeight(result[3], "lb")).toBe("131.3");
    expect(interpolateStandards(standards[0].women, 101)).toEqual([101, 32, 44, 51.5, 68.5, 88]);
  });

  it("uses the open-ended final row and refuses weights below the table or nonfinite weights", () => {
    expect(interpolateStandards(standards[0].men, 400)).toEqual([400, 100, 136, 171, 203, 284]);
    expect(interpolateStandards(standards[0].women, 250)).toEqual([250, 58, 79, 93, 123, 159]);
    for (const weight of [113, 0, -1, Infinity, NaN]) {
      expect(interpolateStandards(standards[0].men, weight)).toBeNull();
    }
    expect(interpolateStandards([], 165)).toBeNull();
  });
});

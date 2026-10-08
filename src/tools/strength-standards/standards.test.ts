import { describe, expect, it } from "vitest";
import source from "./data/chrome.txt?raw";
import { formatWeight, standards } from "./standards.ts";

describe("strength standards data", () => {
  it("matches all 110 rows in the supplied source transcription, in activity order", () => {
    const sourceRows = source
      .split(/\r?\n/)
      .filter((line) => /^\d+\+?(?: \d+){5}$/.test(line))
      .map((line) => line.replace("+", "").split(" ").map(Number));
    expect(sourceRows).toHaveLength(110);
    expect(standards.flatMap((activity) => [...activity.men, ...activity.women])).toEqual(
      sourceRows,
    );
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
});

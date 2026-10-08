import { describe, expect, it } from "vitest";
import { calculatorUnits, filterUnits, groupUnits, type CalculatorUnit } from "./units.ts";

function unit(id: string, values: Partial<CalculatorUnit>): CalculatorUnit {
  return {
    id,
    title: "Other",
    names: [id],
    category: "Other",
    baseUnit: "",
    definition: "Base unit",
    description: "",
    ...values,
  };
}

describe("unit catalogue search", () => {
  it("ranks prefix matches before substring matches, then by field priority", () => {
    const units = [
      unit("base-substring", { baseUnit: "a needle" }),
      unit("category-substring", { category: "a needle" }),
      unit("names-substring", { names: ["unused", "a needle"] }),
      unit("title-substring", { title: "a needle" }),
      unit("base-prefix", { baseUnit: "needle base" }),
      unit("category-prefix", { category: "Parent / needle category" }),
      unit("names-prefix", { names: ["unused", "needle name"] }),
      unit("title-prefix", { title: "needle title" }),
      unit("unmatched", {}),
    ];
    expect(filterUnits(units, " NEEDLE ").map((unit) => unit.id)).toEqual([
      "title-prefix",
      "names-prefix",
      "category-prefix",
      "base-prefix",
      "title-substring",
      "names-substring",
      "category-substring",
      "base-substring",
    ]);
  });

  it("keeps source order for ties and empty searches without mutating the catalogue", () => {
    const units = [unit("a", { title: "Meter" }), unit("b", { title: "Meter" })];
    expect(filterUnits(units, "m")).toEqual(units);
    expect(filterUnits(units, "  ")).toEqual(units);
    expect(filterUnits(units, "absent")).toEqual([]);
    expect(units.map((unit) => unit.id)).toEqual(["a", "b"]);
  });

  it("preserves ranked order when categories recur", () => {
    const units = [
      unit("a", { category: "Length" }),
      unit("b", { category: "Time" }),
      unit("c", { category: "Length" }),
      unit("d", { category: "Length" }),
    ];
    const groups = groupUnits(units);
    expect(groups.map((group) => group.category)).toEqual(["Length", "Time", "Length"]);
    expect(groups.flatMap((group) => group.units)).toEqual(units);
    expect(groupUnits([])).toEqual([]);
  });

  it("includes aliases, nested categories, binary prefixes, and temperature relations", () => {
    expect(new Set(calculatorUnits.map((unit) => unit.id)).size).toBe(calculatorUnits.length);
    const meter = calculatorUnits.find((unit) => unit.title === "Meter")!;
    expect(meter.names).toContain("metre");
    expect(filterUnits(calculatorUnits, "metre")).toContain(meter);
    expect(calculatorUnits.find((unit) => unit.title === "Kibibyte")?.definition).toBe(
      "2^10 × byte",
    );
    expect(calculatorUnits.find((unit) => unit.title === "Degree Celsius")?.definition).toBe(
      "x → (x + 273.15) × K",
    );
    expect(calculatorUnits.some((unit) => unit.category.includes(" / "))).toBe(true);
  });
});

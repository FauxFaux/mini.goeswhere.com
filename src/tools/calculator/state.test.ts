import { describe, expect, it } from "vitest";
import { calculatorCodec, MAX_UNIT_FILTER_LENGTH } from "./state.ts";

describe("calculator unit filter URL state", () => {
  it("validates optional Unicode filters", () => {
    for (const state of [
      { v: 1, tiles: [] },
      { v: 1, tiles: [], unitFilter: "" },
      { v: 1, tiles: [], unitFilter: "Ångström" },
      { v: 1, tiles: [], unitFilter: "a".repeat(MAX_UNIT_FILTER_LENGTH) },
    ]) {
      expect(calculatorCodec.decode(state)).toEqual(state);
    }
  });

  it.each([null, 1, [], {}, "a".repeat(MAX_UNIT_FILTER_LENGTH + 1)])(
    "rejects malformed or oversized filters: %j",
    (unitFilter) => {
      expect(() => calculatorCodec.decode({ v: 1, tiles: [], unitFilter })).toThrow();
    },
  );
});

describe("readable calculator URLs", () => {
  it("preserves ordered, duplicate, blank and Unicode expressions and unrelated parameters", () => {
    const state = calculatorCodec.decode({
      v: 1,
      tiles: ["1 + 2", "1 + 2", "", "Å & π = 3"].map((expression, index) => ({
        id: String(index),
        expression,
      })),
      unitFilter: "Ångström & meter",
    });
    const params = new URLSearchParams("note=keep");
    calculatorCodec.query!.write(params, state);
    expect(params.getAll("e")).toEqual(state.tiles.map((tile) => tile.expression));
    expect(params.get("q")).toBe(state.unitFilter);
    expect(params.get("note")).toBe("keep");
    expect(params.has("s")).toBe(false);
    expect(calculatorCodec.query!.decode(new URLSearchParams(params.toString()))).toEqual(state);
  });

  it("reads fresh links, blank tiles and zero tiles", () => {
    expect(
      calculatorCodec.query!.decode(new URLSearchParams("e=2+%2B+2&e=3&q=meter")).tiles,
    ).toEqual([
      { id: "expression-0", expression: "2 + 2" },
      { id: "expression-1", expression: "3" },
    ]);
    expect(calculatorCodec.query!.decode(new URLSearchParams("e=")).tiles).toHaveLength(1);
    const params = new URLSearchParams();
    calculatorCodec.query!.write(params, { v: 1, tiles: [] });
    expect(params.get("empty")).toBe("1");
    expect(calculatorCodec.query!.decode(params).tiles).toEqual([]);
  });

  it.each([
    "q=a&q=b",
    "empty=0",
    "empty=1&e=",
    `e=${"a".repeat(1001)}`,
    `q=${"a".repeat(MAX_UNIT_FILTER_LENGTH + 1)}`,
    Array.from({ length: 49 }, () => "e=1").join("&"),
  ])("rejects malformed query state: %s", (query) => {
    expect(() => calculatorCodec.query!.decode(new URLSearchParams(query))).toThrow();
  });
});

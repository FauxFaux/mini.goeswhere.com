import { describe, expect, it } from "vitest";
import {
  packState,
  readState,
  unpackState,
  UnsupportedStateVersion,
} from "../../boot/url-state.ts";
import { strengthStandardsCodec } from "./state.ts";
import { POUNDS_TO_KG } from "./standards.ts";

describe("strength standards URL codec", () => {
  it("defaults to 75 kg men with category 1 selected, preserving older links", () => {
    expect(readState(null, strengthStandardsCodec)).toEqual({
      kind: "ok",
      state: { v: 1, sex: "men", unit: "kg", weight: 75 / POUNDS_TO_KG, graphCategory: 1 },
    });
    expect(strengthStandardsCodec.decode({ v: 1 })).toEqual({ v: 1, sex: "men", unit: "kg" });
    const defaults = strengthStandardsCodec.defaultState;
    expect(strengthStandardsCodec.decode(unpackState(packState(defaults)))).toEqual(defaults);
  });

  it.each(["men", "women"] as const)("round trips both units for %s", (sex) => {
    for (const unit of ["kg", "lb"] as const) {
      const state = { v: 1, sex, unit };
      expect(strengthStandardsCodec.decode(unpackState(packState(state)))).toEqual(state);
    }
  });

  it.each([
    null,
    [],
    "men",
    { v: 1, sex: "other" },
    { v: 1, sex: null },
    { v: 1, unit: "lbs" },
    { v: 1, unit: 1 },
    { v: 1, unit: null },
  ])("rejects malformed state %j", (value) => {
    expect(() => strengthStandardsCodec.decode(value)).toThrow();
  });

  it("rejects unknown versions", () => {
    expect(() => strengthStandardsCodec.decode({ v: 2 })).toThrow(UnsupportedStateVersion);
  });

  it("round trips bodyweight while preserving older links without a weight", () => {
    const state = { v: 1, sex: "men", unit: "kg", weight: 173 };
    expect(strengthStandardsCodec.decode(unpackState(packState(state)))).toEqual(state);
    expect(strengthStandardsCodec.decode({ v: 1, sex: "women", unit: "lb" })).toEqual({
      v: 1,
      sex: "women",
      unit: "lb",
    });
  });

  it.each([0, 0.5, 1.5, 5])("round trips selected graph category %s", (graphCategory) => {
    const state = { v: 1, sex: "men", unit: "lb", weight: 173, graphCategory };
    expect(strengthStandardsCodec.decode(unpackState(packState(state)))).toEqual(state);
  });

  it.each([null, "1", {}, NaN, Infinity, -Infinity, -0.1, 5.1])(
    "rejects invalid graph category %j",
    (graphCategory) => {
      expect(() => strengthStandardsCodec.decode({ v: 1, graphCategory })).toThrow();
    },
  );

  it.each([null, "165", {}, NaN, Infinity, -Infinity])(
    "rejects invalid bodyweight %j",
    (weight) => {
      expect(() => strengthStandardsCodec.decode({ v: 1, weight })).toThrow();
    },
  );
});

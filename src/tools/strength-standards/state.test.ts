import { describe, expect, it } from "vitest";
import {
  packState,
  readState,
  unpackState,
  UnsupportedStateVersion,
} from "../../boot/url-state.ts";
import { strengthStandardsCodec } from "./state.ts";

describe("strength standards URL codec", () => {
  it("defaults to men and kilograms, including absent optional fields", () => {
    expect(readState(null, strengthStandardsCodec)).toEqual({
      kind: "ok",
      state: { v: 1, sex: "men", unit: "kg" },
    });
    expect(strengthStandardsCodec.decode({ v: 1 })).toEqual(strengthStandardsCodec.defaultState);
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

  it.each([null, "165", {}, NaN, Infinity, -Infinity])(
    "rejects invalid bodyweight %j",
    (weight) => {
      expect(() => strengthStandardsCodec.decode({ v: 1, weight })).toThrow();
    },
  );
});

import { describe, expect, it } from "vitest";
import {
  packState,
  readState,
  readQueryState,
  unpackState,
  UnsupportedStateVersion,
} from "../../boot/url-state.ts";
import { strengthStandardsCodec } from "./state.ts";
import { POUNDS_TO_KG } from "./standards.ts";

describe("strength standards URL codec", () => {
  it("reads the compact query format in the displayed units", () => {
    expect(
      readQueryState(new URLSearchParams("s=m&w=74.5&c=0.082"), strengthStandardsCodec),
    ).toEqual({
      kind: "ok",
      state: { v: 1, sex: "men", unit: "kg", weight: 74.5 / POUNDS_TO_KG, graphCategory: 0.082 },
    });
    expect(
      readQueryState(new URLSearchParams("s=f&u=l&w=165&c=2"), strengthStandardsCodec),
    ).toEqual({
      kind: "ok",
      state: { v: 1, sex: "women", unit: "lb", weight: 165, graphCategory: 2 },
    });
    expect(readQueryState(new URLSearchParams(), strengthStandardsCodec)).toEqual({
      kind: "ok",
      state: strengthStandardsCodec.defaultState,
    });
  });

  it("writes rounded readable inputs, preserves unrelated parameters and clears missing inputs", () => {
    const params = new URLSearchParams("note=keep&u=l");
    strengthStandardsCodec.query!.write(params, {
      v: 1,
      sex: "men",
      unit: "kg",
      weight: 74.456 / POUNDS_TO_KG,
      graphCategory: 0.08167,
    });
    expect(params.toString()).toBe("note=keep&s=m&w=74.5&c=0.082");
    strengthStandardsCodec.query!.write(params, {
      v: 1,
      sex: "women",
      unit: "lb",
      weight: 165,
      graphCategory: 1,
    });
    expect(params.toString()).toBe("note=keep&s=f&w=165&c=1&u=l");
    strengthStandardsCodec.query!.write(params, { v: 1, sex: "men", unit: "kg" });
    expect(readQueryState(params, strengthStandardsCodec)).toEqual({
      kind: "ok",
      state: { v: 1, sex: "men", unit: "kg" },
    });
  });

  it("reads legacy base64 links without rewriting them", () => {
    const state = { v: 1, sex: "women", unit: "lb", weight: 165, graphCategory: 2.5 } as const;
    const params = new URLSearchParams({ s: packState(state), note: "keep" });
    const original = params.toString();
    expect(readQueryState(params, strengthStandardsCodec)).toEqual({ kind: "ok", state });
    expect(params.toString()).toBe(original);
    strengthStandardsCodec.query!.write(params, state);
    expect(params.get("s")).toBe("f");
  });

  it.each([
    "s=x&w=75",
    "u=kg",
    "p=bad",
    "p=5x5&p=1rm",
    "w=NaN",
    "w=Infinity",
    "w=hello",
    "w= ",
    "w=0x10",
    "w=" + "1".repeat(33),
    "c=-0.1",
    "c=5.01",
    "c=NaN",
    "s=m&s=f",
    "w=75&w=80",
    "c=1&c=2",
    "u=k&u=l",
  ])("rejects malformed query %s", (query) => {
    expect(readQueryState(new URLSearchParams(query), strengthStandardsCodec).kind).toBe(
      "unpack-error",
    );
  });

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
    { v: 1, performance: null },
    { v: 1, performance: "bad" },
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

it("round trips the 5x5 selection in query and legacy state formats", () => {
  const state = { ...strengthStandardsCodec.defaultState, performance: "5x5" } as const;
  const params = new URLSearchParams();
  strengthStandardsCodec.query!.write(params, state);
  expect(strengthStandardsCodec.query!.decode(params)).toEqual(state);
  expect(strengthStandardsCodec.decode(unpackState(packState(state)))).toEqual(state);
});

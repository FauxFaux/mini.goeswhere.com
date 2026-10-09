import { expect, it, vi } from "vitest";
import { readQueryState, UnsupportedStateVersion } from "../../boot/url-state.ts";
import { earthMoonCodec as codec, minInstant, maxInstant } from "./state.ts";

it("round trips coordinate, instant and scale extremes without touching unrelated parameters", () => {
  for (const instant of [minInstant, maxInstant, Date.UTC(2026, 9, 9, 12, 34, 56)]) {
    for (const trueDistance of [true, false]) {
      for (const location of [
        { latitude: -90, longitude: 180 },
        { latitude: 90, longitude: -180 },
        { latitude: 1e-20, longitude: 0 },
      ]) {
        const state = { v: 1 as const, instant, trueDistance, location };
        const params = new URLSearchParams("note=keep&v=1");
        codec.query!.write(params, state);
        expect(codec.query!.decode(params)).toEqual(state);
        expect(codec.decode(state)).toEqual(state);
        expect(params.get("note")).toBe("keep");
      }
    }
  }
});

it("defaults to London and now, and applies the optional distance default", () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 9, 9));
  try {
    const params = new URLSearchParams("note=keep");
    expect(codec.query!.decode(params)).toEqual(codec.defaultState);
    expect(params.toString()).toBe("note=keep");
    expect(
      codec.decode({ v: 1, location: { latitude: 0, longitude: 0 }, instant: minInstant })
        .trueDistance,
    ).toBe(false);
  } finally {
    now.mockRestore();
  }
});

it.each([
  "at=invalid",
  "at=2026-02-30T00%3A00%3A00.000Z",
  "at=2026-10-09",
  "at=1899-12-31T00%3A00%3A00.000Z",
  "at=2100-01-01T00%3A00%3A00.000Z",
  "at=2026-10-09T00%3A00%3A00.000Z&at=x",
  "lat=0",
  "lat=NaN&lon=0",
  "lat=91&lon=0",
  "lat=1&lon=181",
  "lat=1&lat=2&lon=0",
  "scale=other",
  "scale=true&scale=compact",
  "v=1&v=1",
])("rejects malformed query state without rewriting it: %s", (query) => {
  const params = new URLSearchParams(query);
  const original = params.toString();
  expect(readQueryState(params, codec).kind).toBe("unpack-error");
  expect(params.toString()).toBe(original);
});

it.each([
  null,
  [],
  {},
  { v: 1, location: null, instant: minInstant },
  { v: 1, location: { latitude: 0, longitude: 0 }, instant: NaN },
  { v: 1, location: { latitude: 0, longitude: 0 }, instant: minInstant - 1 },
  { v: 1, location: { latitude: 0, longitude: 0 }, instant: minInstant, trueDistance: "true" },
])("rejects malformed structured state: %j", (value) => {
  expect(() => codec.decode(value)).toThrow();
});

it("reports unknown versions", () => {
  expect(() => codec.query!.decode(new URLSearchParams("v=2"))).toThrow(UnsupportedStateVersion);
  expect(() => codec.decode({ v: 2 })).toThrow(UnsupportedStateVersion);
});

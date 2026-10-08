import { expect, it } from "vitest";
import { UnsupportedStateVersion } from "../../boot/url-state.ts";
import { locationPickerCodec as codec } from "./state.ts";

it("round trips selections while preserving unrelated parameters", () => {
  for (const location of [
    { latitude: 51.5074, longitude: -0.1278 },
    { latitude: -90, longitude: 180 },
    { latitude: 90, longitude: -180 },
    { latitude: 1e-20, longitude: 0 },
  ]) {
    const state = { v: 1 as const, location };
    const params = new URLSearchParams("note=keep&lat=1&lon=2&v=1");
    codec.query!.write(params, state);
    expect(codec.query!.decode(params)).toEqual(state);
    expect(codec.decode(state)).toEqual(state);
    expect(params.get("note")).toBe("keep");
  }
});

it("defaults to London without rewriting", () => {
  const params = new URLSearchParams("note=keep");
  expect(codec.query!.decode(params)).toEqual({
    v: 1,
    location: { latitude: 51.5074, longitude: -0.1278 },
  });
  expect(params.toString()).toBe("note=keep");
  const cleared = new URLSearchParams("note=keep&lat=&lon=");
  expect(codec.query!.decode(cleared)).toEqual(codec.defaultState);
  expect(cleared.toString()).toBe("note=keep&lat=&lon=");
  expect(codec.decode({ v: 1, location: null })).toEqual(codec.defaultState);
});

it.each([
  "lat=1",
  "lon=1",
  "lat=&lon=0",
  "lat=91&lon=0",
  "lat=0&lon=-181",
  "lat=NaN&lon=0",
  "lat=Infinity&lon=0",
  "lat=0x10&lon=0",
  "lat=0&lon=0&lat=1",
  "lat=0&lon=1&lon=2",
  "v=1&v=1",
  "lat=1e999&lon=0",
  `lat=${"1".repeat(33)}&lon=0`,
])("rejects malformed queries: %s", (query) => {
  expect(() => codec.query!.decode(new URLSearchParams(query))).toThrow();
});

it.each([
  null,
  [],
  {},
  { v: 1 },
  { v: 1, location: [] },
  { v: 1, location: { latitude: "0", longitude: 0 } },
  ...[NaN, Infinity, 91, -91].map((latitude) => ({ v: 1, location: { latitude, longitude: 0 } })),
])("rejects malformed state: %j", (value) => {
  expect(() => codec.decode(value)).toThrow();
});

it("rejects unknown versions", () => {
  expect(() => codec.decode({ v: 2, location: null })).toThrow(UnsupportedStateVersion);
  expect(() => codec.query!.decode(new URLSearchParams("v=2"))).toThrow(UnsupportedStateVersion);
});

import { describe, expect, it } from "vitest";
import { packState, readState, UnsupportedStateVersion } from "../../boot/url-state.ts";
import { fuelElectricCodec, limits } from "./state.ts";

describe("fuel comparison URL state", () => {
  it("rounds URL values to display precision plus one decimal for consumption", () => {
    const query = fuelElectricCodec.query!;
    const params = new URLSearchParams();
    query.write(params, {
      ...fuelElectricCodec.defaultState,
      chargingPence: 6.123456,
      petrolPence: 145.987654,
      mpg: 44.56789,
      annualKm: 10000.1234,
    });
    expect(Object.fromEntries(params)).toEqual({
      v: "1",
      c: "6.12",
      p: "145.99",
      m: "44.57",
      e: "14.12",
      d: "10000",
      u: "mpg",
      t: "miles",
    });
    const first = params.toString();
    query.write(params, query.decode(params));
    expect(params.toString()).toBe(first);
    query.write(params, { ...fuelElectricCodec.defaultState, mpg: 45, kwhPer100km: 18 });
    expect(params.get("m")).toBe("45");
    expect(params.get("e")).toBe("18");
  });
  it("round trips readable parameters and preserves unrelated parameters", () => {
    const query = fuelElectricCodec.query!;
    for (const electricUnit of ["kwh", "miles"] as const) {
      for (const edge of [0, 1] as const) {
        const state = {
          ...fuelElectricCodec.defaultState,
          electricUnit,
          petrolUnit: "litres" as const,
        };
        for (const key of Object.keys(limits) as (keyof typeof limits)[])
          state[key] = limits[key][edge];
        const params = new URLSearchParams("note=keep&s=old");
        query.write(params, state);
        expect(params.get("note")).toBe("keep");
        expect(params.has("s")).toBe(false);
        expect(query.decode(params)).toEqual(state);
      }
    }
    expect(query.decode(new URLSearchParams())).toEqual(fuelElectricCodec.defaultState);
    expect(query.decode(new URLSearchParams("c=20&d=5000"))).toMatchObject({
      chargingPence: 20,
      annualKm: 5000,
    });
  });
  it("reads legacy links without rewriting them and rejects corrupt query parameters", () => {
    const query = fuelElectricCodec.query!;
    const legacy = new URLSearchParams({ s: packState(fuelElectricCodec.defaultState) });
    const original = legacy.toString();
    expect(query.decode(legacy)).toEqual(fuelElectricCodec.defaultState);
    expect(legacy.toString()).toBe(original);
    for (const search of [
      "c=",
      "c=NaN",
      "c=Infinity",
      "c=0x20",
      `c=${limits.chargingPence[1] + 1}`,
      "e=31",
      "m=29",
      "d=20001",
      "p=49",
      "c=6&c=7",
      "t=no",
      "u=no",
      "v=2",
      "s=bad",
      `s=${legacy.get("s")}&c=10`,
    ])
      expect(() => query.decode(new URLSearchParams(search))).toThrow();
  });
  it("round trips inputs, including units and range boundaries", () => {
    for (const edge of [0, 1] as const) {
      const state = { ...fuelElectricCodec.defaultState, petrolUnit: "litres" as const };
      for (const key of Object.keys(limits) as (keyof typeof limits)[])
        state[key] = limits[key][edge];
      expect(readState(packState(state), fuelElectricCodec)).toEqual({ kind: "ok", state });
    }
    expect(fuelElectricCodec.decode({ v: 1 })).toEqual({
      ...fuelElectricCodec.defaultState,
      electricUnit: "kwh",
    });
    expect(fuelElectricCodec.decode({ v: 1, kwhPer100km: 18 })).toMatchObject({
      kwhPer100km: 18,
      electricUnit: "kwh",
    });
  });
  it("rejects malformed fields and unsupported versions", () => {
    for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
      for (const value of [null, "10", NaN, Infinity, limits[key][0] - 1, limits[key][1] + 1])
        expect(() => fuelElectricCodec.decode({ v: 1, [key]: value })).toThrow();
    }
    for (const value of [
      null,
      [],
      "oops",
      { v: 1, petrolUnit: "US mpg" },
      { v: 1, electricUnit: "invalid" },
    ])
      expect(() => fuelElectricCodec.decode(value)).toThrow();
    expect(() => fuelElectricCodec.decode({ v: 2 })).toThrow(UnsupportedStateVersion);
  });
});

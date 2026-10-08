import { expect, it } from "vitest";
import { UnsupportedStateVersion } from "../../boot/url-state.ts";
import { analogueClockCodec } from "./state.ts";
import { currentYear } from "./year.ts";

it("round trips integer seconds and every combination of number toggles", () => {
  for (const seconds of [0, 1, 36600, 86400, currentYear.seconds - 1]) {
    for (const show12HourNumbers of [false, true]) {
      for (const show24HourNumbers of [false, true]) {
        for (const showMinuteNumbers of [false, true]) {
          const state = {
            v: 2 as const,
            seconds,
            show12HourNumbers,
            show24HourNumbers,
            showMinuteNumbers,
            sideBySide: false,
            location: { latitude: 51.5074, longitude: -0.1278 },
          };
          const params = new URLSearchParams({ note: "keep", v: "2" });
          analogueClockCodec.query!.write(params, state);
          expect(params.get("note")).toBe("keep");
          expect(params.get("s")).toBe(String(seconds));
          expect(params.has("v")).toBe(false);
          expect(analogueClockCodec.query!.decode(params)).toEqual(state);
          expect(analogueClockCodec.decode(state)).toEqual(state);
        }
      }
    }
  }
});

it("reads defaults without changing the URL", () => {
  const params = new URLSearchParams("note=keep");
  expect(analogueClockCodec.query!.decode(params)).toEqual(analogueClockCodec.defaultState);
  expect(params.toString()).toBe("note=keep");
});

it.each(["show12HourNumbers", "show24HourNumbers", "showMinuteNumbers", "sideBySide"])(
  "validates %s strictly",
  (field) => {
    for (const value of [null, 1, "false", [], {}]) {
      expect(() => analogueClockCodec.decode({ v: 2, seconds: 0, [field]: value })).toThrow(
        "Clock settings must be booleans.",
      );
    }
  },
);

it.each([
  null,
  [],
  "clock",
  {},
  { v: 2 },
  ...[-1, 0.5, currentYear.seconds, Infinity, NaN, "90", null].map((seconds) => ({
    v: 2,
    seconds,
  })),
])("rejects malformed clock state: %j", (value) => {
  expect(() => analogueClockCodec.decode(value)).toThrow();
});

it.each([
  "s=",
  "s=-1",
  "s=0.5",
  "s=1e3",
  `s=${currentYear.seconds}`,
  "s=Infinity",
  "s=NaN",
  "s=0x10",
  "s=" + "1".repeat(9),
  "s=1&s=2",
  "h=false",
  "t=2",
  "m=",
  "b=2",
  "b=",
  "b=0&b=1",
  "h=0&h=1",
  "t=1&t=1",
  "m=0&m=0",
  "v=2&v=2",
  "s=eyJ2IjoxfQ",
])("rejects malformed queries: %s", (query) => {
  expect(() => analogueClockCodec.query!.decode(new URLSearchParams(query))).toThrow();
});

it("rejects unsupported versions", () => {
  expect(() => analogueClockCodec.decode({ v: 3, seconds: 60 })).toThrow(UnsupportedStateVersion);
  expect(() => analogueClockCodec.query!.decode(new URLSearchParams("v=3&s=90"))).toThrow(
    UnsupportedStateVersion,
  );
});

it("round trips the layout setting and omits it when stacked", () => {
  for (const sideBySide of [false, true]) {
    const state = { ...analogueClockCodec.defaultState, sideBySide };
    const params = new URLSearchParams("b=1&note=keep");
    analogueClockCodec.query!.write(params, state);
    expect(params.get("b")).toBe(sideBySide ? "1" : null);
    expect(analogueClockCodec.query!.decode(params)).toEqual(state);
  }
});

it("round trips location coordinates while keeping old clock links compatible", () => {
  const state = {
    ...analogueClockCodec.defaultState,
    seconds: 123,
    location: { latitude: -33.8688, longitude: 151.2093 },
  };
  const params = new URLSearchParams("note=keep");
  analogueClockCodec.query!.write(params, state);
  expect(params.get("lat")).toBe("-33.8688");
  expect(params.get("lon")).toBe("151.2093");
  expect(params.get("note")).toBe("keep");
  expect(analogueClockCodec.query!.decode(params)).toEqual(state);
  expect(analogueClockCodec.decode(state)).toEqual(state);
  analogueClockCodec.query!.write(params, analogueClockCodec.defaultState);
  expect(params.has("lat")).toBe(false);
  expect(params.has("lon")).toBe(false);
  expect(analogueClockCodec.decode({ v: 2, seconds: 123 }).location).toEqual({
    latitude: 51.5074,
    longitude: -0.1278,
  });
});

it.each([
  "lat=91&lon=0",
  "lat=0&lon=-181",
  "lat=NaN&lon=0",
  "lat=0",
  "lon=0",
  "lat=0&lat=1&lon=0",
  "lat=0&lon=0&lon=1",
  "lat=&lon=",
  "lat=0x10&lon=0",
])("rejects malformed clock locations: %s", (query) => {
  expect(() => analogueClockCodec.query!.decode(new URLSearchParams(query))).toThrow();
});

it.each([
  null,
  {},
  { latitude: 91, longitude: 0 },
  { latitude: 0, longitude: Infinity },
  { latitude: "0", longitude: 0 },
])("rejects malformed structured locations: %j", (location) => {
  expect(() => analogueClockCodec.decode({ v: 2, seconds: 0, location })).toThrow();
});

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

it.each(["show12HourNumbers", "show24HourNumbers", "showMinuteNumbers"])(
  "validates %s strictly",
  (field) => {
    for (const value of [null, 1, "false", [], {}]) {
      expect(() => analogueClockCodec.decode({ v: 2, seconds: 0, [field]: value })).toThrow(
        "Clock number toggles must be booleans.",
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

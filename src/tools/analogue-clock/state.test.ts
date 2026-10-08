import { expect, it } from "vitest";
import { packState, unpackState, UnsupportedStateVersion } from "../../boot/url-state.ts";
import { analogueClockCodec } from "./state.ts";

it("round trips smooth hand positions", () => {
  for (const minutes of [0, 610, 719.999, 32.125]) {
    const state = { ...analogueClockCodec.defaultState, minutes };
    expect(analogueClockCodec.decode(unpackState(packState(state)))).toEqual(state);
  }
});

it("defaults old shared links to 12-hour numbers only", () => {
  expect(analogueClockCodec.decode({ v: 1, minutes: 90 })).toEqual({
    ...analogueClockCodec.defaultState,
    minutes: 90,
  });
});

it("round trips every combination of number toggles", () => {
  for (const show12HourNumbers of [false, true]) {
    for (const show24HourNumbers of [false, true]) {
      for (const showMinuteNumbers of [false, true]) {
        const state = {
          ...analogueClockCodec.defaultState,
          show12HourNumbers,
          show24HourNumbers,
          showMinuteNumbers,
        };
        expect(analogueClockCodec.decode(unpackState(packState(state)))).toEqual(state);
      }
    }
  }
});

it.each(["show12HourNumbers", "show24HourNumbers", "showMinuteNumbers"])(
  "validates %s strictly",
  (field) => {
    for (const value of [null, 1, "false", [], {}]) {
      expect(() => analogueClockCodec.decode({ v: 1, minutes: 0, [field]: value })).toThrow(
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
  { v: 1 },
  ...[-1, 720, Infinity, NaN, "90", null].map((minutes) => ({ v: 1, minutes })),
])("rejects malformed clock state: %j", (value) => {
  expect(() => analogueClockCodec.decode(value)).toThrow();
});

it("reports unknown versions", () => {
  expect(() => analogueClockCodec.decode({ v: 2, minutes: 60 })).toThrow(UnsupportedStateVersion);
});

it("round trips readable queries, preserving unrelated parameters and removing legacy state", () => {
  for (const minutes of [0, 610, 719.999, 1e-9]) {
    for (const show12HourNumbers of [false, true]) {
      for (const show24HourNumbers of [false, true]) {
        for (const showMinuteNumbers of [false, true]) {
          const state = {
            v: 1 as const,
            minutes,
            show12HourNumbers,
            show24HourNumbers,
            showMinuteNumbers,
          };
          const params = new URLSearchParams({ note: "keep", s: packState(state), v: "1" });
          analogueClockCodec.query!.write(params, state);
          expect(params.get("note")).toBe("keep");
          expect(params.has("s")).toBe(false);
          expect(analogueClockCodec.query!.decode(params)).toEqual(state);
        }
      }
    }
  }
});

it("reads defaults and existing base64 links without changing them", () => {
  expect(analogueClockCodec.query!.decode(new URLSearchParams())).toEqual(
    analogueClockCodec.defaultState,
  );
  const oldState = { v: 1, minutes: 90 };
  const params = new URLSearchParams({ s: packState(oldState) });
  const original = params.toString();
  expect(analogueClockCodec.query!.decode(params)).toEqual({
    ...analogueClockCodec.defaultState,
    minutes: 90,
  });
  expect(params.toString()).toBe(original);
});

it.each([
  "minutes=",
  "minutes=-1",
  "minutes=720",
  "minutes=Infinity",
  "minutes=NaN",
  "minutes=0x10",
  "minutes=" + "1".repeat(33),
  "minutes=1&minutes=2",
  "hours12=false",
  "hours24=2",
  "minuteNumbers=",
  "hours12=0&hours12=1",
  "hours24=1&hours24=1",
  "minuteNumbers=0&minuteNumbers=0",
  "v=1&v=1",
  "s=bad&s=bad",
  "s=bad&minutes=0",
])("rejects malformed readable queries: %s", (query) => {
  expect(() => analogueClockCodec.query!.decode(new URLSearchParams(query))).toThrow();
});

it("rejects unsupported query versions", () => {
  expect(() => analogueClockCodec.query!.decode(new URLSearchParams("v=2&minutes=90"))).toThrow(
    UnsupportedStateVersion,
  );
});

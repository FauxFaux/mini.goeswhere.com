import {
  isRecord,
  unpackState,
  UnsupportedStateVersion,
  type UrlCodec,
} from "../../boot/url-state.ts";

export interface AnalogueClockState {
  v: 1;
  minutes: number;
  show12HourNumbers: boolean;
  show24HourNumbers: boolean;
  showMinuteNumbers: boolean;
}

export const analogueClockCodec: UrlCodec<AnalogueClockState> = {
  defaultState: {
    v: 1,
    minutes: 610,
    show12HourNumbers: true,
    show24HourNumbers: false,
    showMinuteNumbers: false,
  },
  query: {
    decode(params) {
      const fields = ["v", "minutes", "hours12", "hours24", "minuteNumbers"];
      for (const key of ["s", ...fields]) {
        if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key} parameter.`);
      }
      if (params.has("s")) {
        if (fields.some((key) => params.has(key))) throw new Error("Mixed clock URL formats.");
        return analogueClockCodec.decode(unpackState(params.get("s")!));
      }
      if (params.has("v") && params.get("v") !== "1") throw new UnsupportedStateVersion();
      const time = params.get("minutes");
      if (time !== null && (time.length > 32 || !/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(time))) {
        throw new Error("Invalid clock minutes parameter.");
      }
      const toggle = (key: string, fallback: boolean) => {
        const value = params.get(key);
        if (value === null) return fallback;
        if (value !== "0" && value !== "1") throw new Error(`Invalid ${key} parameter.`);
        return value === "1";
      };
      return analogueClockCodec.decode({
        v: 1,
        minutes: time === null ? analogueClockCodec.defaultState.minutes : Number(time),
        show12HourNumbers: toggle("hours12", true),
        show24HourNumbers: toggle("hours24", false),
        showMinuteNumbers: toggle("minuteNumbers", false),
      });
    },
    write(params, state) {
      params.delete("s");
      params.delete("v");
      params.set("minutes", String(state.minutes));
      const toggle = (key: string, value: boolean, fallback: boolean) => {
        if (value === fallback) params.delete(key);
        else params.set(key, value ? "1" : "0");
      };
      toggle("hours12", state.show12HourNumbers, true);
      toggle("hours24", state.show24HourNumbers, false);
      toggle("minuteNumbers", state.showMinuteNumbers, false);
    },
  },
  decode(value) {
    if (!isRecord(value)) throw new Error("Clock state must be an object.");
    if (value.v !== 1) throw new UnsupportedStateVersion();
    if (
      typeof value.minutes !== "number" ||
      !Number.isFinite(value.minutes) ||
      value.minutes < 0 ||
      value.minutes >= 720
    ) {
      throw new Error("Clock time must be between 0 (inclusive) and 720 (exclusive) minutes.");
    }
    return {
      v: 1,
      minutes: value.minutes,
      show12HourNumbers: decodeToggle(value.show12HourNumbers, true),
      show24HourNumbers: decodeToggle(value.show24HourNumbers, false),
      showMinuteNumbers: decodeToggle(value.showMinuteNumbers, false),
    };
  },
};

function decodeToggle(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error("Clock number toggles must be booleans.");
  return value;
}

import {
  decodeLocation,
  londonLocation,
  readLocation,
  writeLocation,
} from "../../components/location-picker/location.ts";
import type { Location } from "../../components/location-picker/projection.ts";
import { isRecord, UnsupportedStateVersion, type UrlCodec } from "../../boot/url-state.ts";
import { currentYear, initialSeconds } from "./year.ts";

export interface AnalogueClockState {
  v: 2;
  seconds: number;
  location: Location;
  show12HourNumbers: boolean;
  show24HourNumbers: boolean;
  showMinuteNumbers: boolean;
  sideBySide: boolean;
}

export const analogueClockCodec: UrlCodec<AnalogueClockState> = {
  defaultState: {
    v: 2,
    seconds: initialSeconds,
    location: { ...londonLocation },
    show12HourNumbers: true,
    show24HourNumbers: false,
    showMinuteNumbers: false,
    sideBySide: false,
  },
  query: {
    decode(params) {
      const fields = ["s", "v", "h", "t", "m", "b"];
      for (const key of fields) {
        if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key} parameter.`);
      }
      if (params.has("v") && params.get("v") !== "2") throw new UnsupportedStateVersion();
      const seconds = params.get("s");
      if (seconds !== null && (seconds.length > 8 || !/^\d+$/.test(seconds))) {
        throw new Error("Invalid clock seconds parameter.");
      }
      const toggle = (key: string, fallback: boolean) => {
        const value = params.get(key);
        if (value === null) return fallback;
        if (value !== "0" && value !== "1") throw new Error(`Invalid ${key} parameter.`);
        return value === "1";
      };
      return analogueClockCodec.decode({
        v: 2,
        location: readLocation(params),
        seconds: seconds === null ? analogueClockCodec.defaultState.seconds : Number(seconds),
        show12HourNumbers: toggle("h", true),
        show24HourNumbers: toggle("t", false),
        showMinuteNumbers: toggle("m", false),
        sideBySide: toggle("b", false),
      });
    },
    write(params, state) {
      params.delete("v");
      params.set("s", String(state.seconds));
      if (
        state.location.latitude === londonLocation.latitude &&
        state.location.longitude === londonLocation.longitude
      ) {
        params.delete("lat");
        params.delete("lon");
      } else writeLocation(params, state.location);
      const toggle = (key: string, value: boolean, fallback: boolean) => {
        if (value === fallback) params.delete(key);
        else params.set(key, value ? "1" : "0");
      };
      toggle("h", state.show12HourNumbers, true);
      toggle("t", state.show24HourNumbers, false);
      toggle("m", state.showMinuteNumbers, false);
      toggle("b", state.sideBySide, false);
    },
  },
  decode(value) {
    if (!isRecord(value)) throw new Error("Clock state must be an object.");
    if (value.v !== 2) throw new UnsupportedStateVersion();
    const seconds = value.seconds;
    if (
      typeof seconds !== "number" ||
      !Number.isInteger(seconds) ||
      seconds < 0 ||
      seconds >= currentYear.seconds
    ) {
      throw new Error(`Clock seconds must be an integer between 0 and ${currentYear.seconds - 1}.`);
    }
    return {
      v: 2,
      seconds,
      location:
        value.location === undefined ? { ...londonLocation } : decodeLocation(value.location),
      show12HourNumbers: decodeToggle(value.show12HourNumbers, true),
      show24HourNumbers: decodeToggle(value.show24HourNumbers, false),
      showMinuteNumbers: decodeToggle(value.showMinuteNumbers, false),
      sideBySide: decodeToggle(value.sideBySide, false),
    };
  },
};

function decodeToggle(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error("Clock settings must be booleans.");
  return value;
}

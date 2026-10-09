import { isRecord, UnsupportedStateVersion, type UrlCodec } from "../../boot/url-state.ts";
import {
  decodeLocation,
  londonLocation,
  readLocation,
  writeLocation,
} from "../../components/location-picker/location.ts";
import type { Location } from "../../components/location-picker/projection.ts";

export interface EarthMoonState {
  v: 1;
  location: Location;
  instant: number;
  trueDistance: boolean;
}
export const minInstant = Date.UTC(1900, 0, 1);
export const maxInstant = Date.UTC(2100, 0, 1) - 1;

export function validInstant(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minInstant &&
    value <= maxInstant
  );
}

export const earthMoonCodec: UrlCodec<EarthMoonState> = {
  get defaultState(): EarthMoonState {
    return {
      v: 1,
      location: { ...londonLocation },
      instant: Math.min(maxInstant, Math.max(minInstant, Date.now())),
      trueDistance: false,
    };
  },
  decode(value) {
    if (!isRecord(value)) throw new Error("Earth–Moon state must be an object.");
    if (value.v !== 1) throw new UnsupportedStateVersion();
    if (!validInstant(value.instant)) throw new Error("Choose a date between 1900 and 2099.");
    if (value.trueDistance !== undefined && typeof value.trueDistance !== "boolean")
      throw new Error("Invalid distance setting.");
    return {
      v: 1,
      location: decodeLocation(value.location),
      instant: value.instant,
      trueDistance: value.trueDistance ?? false,
    };
  },
  query: {
    decode(params) {
      for (const key of ["v", "at", "scale"]) {
        if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key} parameter.`);
      }
      if (params.has("v") && params.get("v") !== "1") throw new UnsupportedStateVersion();
      const instant = params.has("at")
        ? Date.parse(params.get("at")!)
        : earthMoonCodec.defaultState.instant;
      if (
        !validInstant(instant) ||
        (params.has("at") &&
          (params.get("at")!.length > 24 || new Date(instant).toISOString() !== params.get("at")))
      )
        throw new Error("Invalid UTC date. Choose a date between 1900 and 2099.");
      const distance = params.get("scale");
      if (distance !== null && distance !== "true" && distance !== "compact")
        throw new Error("Invalid distance setting.");
      return { v: 1, location: readLocation(params), instant, trueDistance: distance === "true" };
    },
    write(params, state) {
      params.delete("v");
      writeLocation(params, state.location);
      params.set("at", new Date(state.instant).toISOString());
      params.set("scale", state.trueDistance ? "true" : "compact");
    },
  },
};

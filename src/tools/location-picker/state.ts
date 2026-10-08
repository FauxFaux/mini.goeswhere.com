import { isRecord, UnsupportedStateVersion, type UrlCodec } from "../../boot/url-state.ts";
import type { Location } from "../../components/location-picker/projection.ts";
import {
  decodeLocation,
  londonLocation,
  readLocation,
  writeLocation,
} from "../../components/location-picker/location.ts";

export interface LocationPickerState {
  v: 1;
  location: Location;
}

export const locationPickerCodec: UrlCodec<LocationPickerState> = {
  defaultState: { v: 1, location: { ...londonLocation } },
  decode(value) {
    if (!isRecord(value)) throw new Error("Location picker state must be an object.");
    if (value.v !== 1) throw new UnsupportedStateVersion();
    if (value.location === null) return locationPickerCodec.defaultState;
    return { v: 1, location: decodeLocation(value.location) };
  },
  query: {
    decode(params) {
      for (const key of ["v", "lat", "lon"]) {
        if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key} parameter.`);
      }
      if (params.has("v") && params.get("v") !== "1") throw new UnsupportedStateVersion();
      if (!params.has("lat") && !params.has("lon")) return locationPickerCodec.defaultState;
      // Older links could explicitly clear the location; restore those to London.
      if (params.get("lat") === "" && params.get("lon") === "")
        return locationPickerCodec.defaultState;
      return { v: 1, location: readLocation(params) };
    },
    write(params, state) {
      params.delete("v");
      writeLocation(params, state.location);
    },
  },
};

import { isRecord, UnsupportedStateVersion, type UrlCodec } from "../../boot/url-state.ts";
import { isLocation, type Location } from "./projection.ts";

export interface LocationPickerState {
  v: 1;
  location: Location | null;
}

export const locationPickerCodec: UrlCodec<LocationPickerState> = {
  defaultState: { v: 1, location: { latitude: 51.5074, longitude: -0.1278 } },
  decode(value) {
    if (!isRecord(value)) throw new Error("Location picker state must be an object.");
    if (value.v !== 1) throw new UnsupportedStateVersion();
    if (value.location === null) return { v: 1, location: null };
    const location = value.location;
    if (
      !isRecord(location) ||
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number" ||
      !isLocation({ latitude: location.latitude, longitude: location.longitude })
    ) {
      throw new Error("Latitude must be between −90 and 90, and longitude between −180 and 180.");
    }
    return { v: 1, location: { latitude: location.latitude, longitude: location.longitude } };
  },
  query: {
    decode(params) {
      for (const key of ["v", "lat", "lon"]) {
        if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key} parameter.`);
      }
      if (params.has("v") && params.get("v") !== "1") throw new UnsupportedStateVersion();
      if (!params.has("lat") && !params.has("lon")) return locationPickerCodec.defaultState;
      // Both empty coordinates explicitly persist Clear; omitted coordinates default to London.
      if (params.get("lat") === "" && params.get("lon") === "") return { v: 1, location: null };
      const coordinate = (key: string) => {
        const value = params.get(key);
        if (
          value === null ||
          value.length > 32 ||
          !/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)
        ) {
          throw new Error(`Invalid ${key} coordinate.`);
        }
        return Number(value);
      };
      return locationPickerCodec.decode({
        v: 1,
        location: { latitude: coordinate("lat"), longitude: coordinate("lon") },
      });
    },
    write(params, state) {
      params.delete("v");
      if (state.location === null) {
        params.set("lat", "");
        params.set("lon", "");
      } else {
        params.set("lat", String(state.location.latitude));
        params.set("lon", String(state.location.longitude));
      }
    },
  },
};

import { isRecord } from "../../boot/url-state.ts";
import { isLocation, type Location } from "./projection.ts";

export const londonLocation: Location = { latitude: 51.5074, longitude: -0.1278 };

export function decodeLocation(value: unknown): Location {
  if (
    !isRecord(value) ||
    typeof value.latitude !== "number" ||
    typeof value.longitude !== "number" ||
    !isLocation({ latitude: value.latitude, longitude: value.longitude })
  ) {
    throw new Error("Latitude must be between −90 and 90, and longitude between −180 and 180.");
  }
  return { latitude: value.latitude, longitude: value.longitude };
}

export function readLocation(params: URLSearchParams): Location {
  for (const key of ["lat", "lon"]) {
    if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key} parameter.`);
  }
  if (!params.has("lat") && !params.has("lon")) return { ...londonLocation };
  const coordinate = (key: string) => {
    const value = params.get(key);
    if (value === null || value.length > 32 || !/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)) {
      throw new Error(`Invalid ${key} coordinate.`);
    }
    return Number(value);
  };
  return decodeLocation({ latitude: coordinate("lat"), longitude: coordinate("lon") });
}

export function writeLocation(params: URLSearchParams, location: Location) {
  params.set("lat", String(location.latitude));
  params.set("lon", String(location.longitude));
}

export function locationLabel(location: Location): string {
  return location.latitude === londonLocation.latitude &&
    location.longitude === londonLocation.longitude
    ? "London"
    : `${location.latitude}°, ${location.longitude}°`;
}

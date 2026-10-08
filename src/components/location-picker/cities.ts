import { isLocation, type Location } from "./projection.ts";

export interface City extends Location {
  id: number;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  searchText: string;
}

function searchText(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

export function decodeCities(value: unknown): City[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100_000) {
    throw new Error("Invalid city catalogue.");
  }
  const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
  const cities = value.map((row: unknown, id): City => {
    if (
      !Array.isArray(row) ||
      row.length !== 5 ||
      typeof row[0] !== "string" ||
      row[0].length === 0 ||
      row[0].length > 200 ||
      typeof row[1] !== "string" ||
      !/^[A-Z]{2}$/.test(row[1]) ||
      typeof row[2] !== "string" ||
      row[2].length > 200 ||
      typeof row[3] !== "number" ||
      typeof row[4] !== "number" ||
      !isLocation({ latitude: row[3], longitude: row[4] })
    )
      throw new Error("Invalid city catalogue row.");
    const [name, countryCode, region, latitude, longitude] = row as [
      string,
      string,
      string,
      number,
      number,
    ];
    const country = countryNames.of(countryCode) ?? countryCode;
    return {
      id,
      name,
      countryCode,
      country,
      region,
      latitude,
      longitude,
      searchText: searchText(`${name} ${countryCode} ${country} ${region}`),
    };
  });
  return cities.sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.country.localeCompare(b.country) ||
      a.region.localeCompare(b.region),
  );
}

let catalogue: Promise<City[]> | undefined;

/** The JSON is a separate chunk, requested only when the picker mounts. */
export function loadCities(): Promise<City[]> {
  return (catalogue ??= import("../../assets/cities.json")
    .then(({ default: data }) => decodeCities(data))
    .catch((error: unknown) => {
      catalogue = undefined;
      throw error;
    }));
}

export function searchCities(cities: City[], query: string): City[] {
  const terms = searchText(query).trim().split(/\s+/).filter(Boolean);
  return terms.length === 0
    ? cities
    : cities.filter((city) => terms.every((term) => city.searchText.includes(term)));
}

export function distanceKm(a: Location, b: Location): number {
  const radians = Math.PI / 180;
  const latitude = (b.latitude - a.latitude) * radians;
  const longitude = (b.longitude - a.longitude) * radians;
  const haversine =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(longitude / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, haversine))));
}

/** Describe a point relative to its nearest catalogue city, rounding kilometres to 1 sf. */
export function describeLocation(location: Location, cities: readonly City[]): string {
  if (!isLocation(location)) throw new Error("Invalid location.");
  if (cities.length === 0) throw new Error("Cannot describe a location without cities.");

  let nearest = cities[0];
  let distance = distanceKm(nearest, location);
  for (const city of cities.slice(1)) {
    const candidateDistance = distanceKm(city, location);
    if (candidateDistance < distance) {
      nearest = city;
      distance = candidateDistance;
    }
  }

  const place = `${nearest.name}, ${nearest.country}`;
  if (distance <= 5) return nearest.name;
  if (distance <= 50) return `Near ${place}`;

  // Initial great-circle bearing from the city towards the point.
  const radians = Math.PI / 180;
  const fromLatitude = nearest.latitude * radians;
  const toLatitude = location.latitude * radians;
  const longitude = (location.longitude - nearest.longitude) * radians;
  const bearing = Math.atan2(
    Math.sin(longitude) * Math.cos(toLatitude),
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
      Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitude),
  );
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const direction = directions[(Math.round(bearing / (Math.PI / 4)) + 8) % 8];
  const roundedDistance = Number(distance.toPrecision(1));
  return `~${roundedDistance}km ${direction} of ${place}`;
}

export function rankCities(cities: City[], location: Location): { city: City; distance: number }[] {
  const ranked = cities.map((city) => ({
    city,
    distance: distanceKm(city, location),
  }));
  // The catalogue is alphabetic; stable sorting preserves that order for distance ties.
  return ranked.sort((a, b) => a.distance - b.distance);
}

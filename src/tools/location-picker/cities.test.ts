import { expect, it } from "vitest";
import { decodeCities, describeLocation, distanceKm, rankCities, searchCities } from "./cities.ts";

const cities = decodeCities([
  ["São Paulo", "BR", "São Paulo", -23.55, -46.634],
  ["London", "GB", "London, City of", 51.507, -0.128],
  ["London", "CA", "Ontario", 42.984, -81.25],
  ["Sydney", "AU", "New South Wales", -33.868, 151.21],
]);

it("describes a point near its nearest city without changing the catalogue", () => {
  const original = [...cities];
  expect(describeLocation({ latitude: 51.5074, longitude: -0.1278 }, cities)).toBe(
    "near London, United Kingdom",
  );
  expect(cities).toEqual(original);
});

it("describes a remote point southeast of Papeete to one significant figure", () => {
  const papeete = decodeCities([["Papeete", "PF", "", -17.5334, -149.5667]]);
  expect(describeLocation({ latitude: -21.3, longitude: -145.5 }, papeete)).toBe(
    "~600km SE of Papeete, French Polynesia",
  );
});

it("applies the 50km threshold before rounding the distance", () => {
  const origin = decodeCities([["Origin", "GB", "", 0, 0]]);
  const latitudeAtKm = (km: number) => (km / 6371.0088) * (180 / Math.PI);
  expect(describeLocation({ latitude: latitudeAtKm(49.999), longitude: 0 }, origin)).toBe(
    "near Origin, United Kingdom",
  );
  expect(describeLocation({ latitude: latitudeAtKm(50.001), longitude: 0 }, origin)).toBe(
    "~50km N of Origin, United Kingdom",
  );
  expect(describeLocation({ latitude: latitudeAtKm(999), longitude: 0 }, origin)).toBe(
    "~1000km N of Origin, United Kingdom",
  );
});

it.each([
  [1, 0, "N"],
  [1, 1, "NE"],
  [0, 1, "E"],
  [-1, 1, "SE"],
  [-1, 0, "S"],
  [-1, -1, "SW"],
  [0, -1, "W"],
  [1, -1, "NW"],
])("uses the bearing from city to point (%s, %s)", (latitude, longitude, direction) => {
  const origin = decodeCities([["Origin", "GB", "", 0, 0]]);
  expect(describeLocation({ latitude, longitude }, origin)).toBe(
    `~${latitude && longitude ? 200 : 100}km ${direction} of Origin, United Kingdom`,
  );
});

it("takes the short route across the antimeridian", () => {
  const origin = decodeCities([["Origin", "GB", "", 0, 179]]);
  expect(describeLocation({ latitude: 0, longitude: -179 }, origin)).toBe(
    "~200km E of Origin, United Kingdom",
  );
});

it("rejects invalid coordinates and an empty catalogue", () => {
  expect(() => describeLocation({ latitude: 0, longitude: 0 }, [])).toThrow();
  for (const location of [
    { latitude: NaN, longitude: 0 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: 181 },
  ]) {
    expect(() => describeLocation(location, cities)).toThrow("Invalid location.");
  }
});

it("searches accents, case, regions, country names and codes with multiple terms", () => {
  expect(searchCities(cities, " SAO paulo ").map((city) => city.name)).toEqual(["São Paulo"]);
  expect(searchCities(cities, "london")).toHaveLength(2);
  expect(searchCities(cities, "London GB")[0].country).toBe("United Kingdom");
  expect(searchCities(cities, "london canada")[0].region).toBe("Ontario");
  expect(searchCities(cities, "new south wales")[0].name).toBe("Sydney");
  expect(searchCities(cities, "missing")).toEqual([]);
  expect(searchCities(cities, "   ")).toBe(cities);
});

it("measures great-circle distance across the antimeridian and near poles", () => {
  expect(
    distanceKm({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 }),
  ).toBeCloseTo(22.239, 2);
  expect(
    distanceKm({ latitude: 89.9, longitude: 0 }, { latitude: 89.9, longitude: 180 }),
  ).toBeCloseTo(22.239, 2);
  expect(distanceKm(cities[0], cities[0])).toBe(0);
});

it("ranks every city by distance without mutating the catalogue, preserving alphabetical ties", () => {
  const local = decodeCities([
    ["Far", "GB", "", 50, 0],
    ["Nearest", "GB", "", 51.507, -0.128],
    ["Second", "GB", "", 51.6, -0.128],
    ["Third", "GB", "", 51.7, -0.128],
    ["Sydney", "AU", "", -33.868, 151.21],
  ]);
  expect(
    rankCities(local, { latitude: 51.5074, longitude: -0.1278 }).map(({ city }) => city.name),
  ).toEqual(["Nearest", "Second", "Third", "Far", "Sydney"]);
  expect(local[0].name).toBe("Far");
  const tied = decodeCities([
    ["Zed", "GB", "", 0, 0],
    ["Alpha", "GB", "", 0, 0],
  ]);
  expect(rankCities(tied, { latitude: 0, longitude: 0 }).map(({ city }) => city.name)).toEqual([
    "Alpha",
    "Zed",
  ]);
});

it.each([
  null,
  {},
  [],
  [["City", "GB", "Region", 91, 0]],
  [["City", "GB", "Region", 0, NaN]],
  [["City", "GB", "Region", "0", 0]],
  [["City", "invalid", "Region", 0, 0]],
  [["", "GB", "Region", 0, 0]],
  [["City", "GB", "Region", 0, 0, 1]],
])("rejects invalid catalogue data: %j", (value) => {
  expect(() => decodeCities(value)).toThrow();
});

it("decodes the generated catalogue and retains both Londons", async () => {
  const { default: data } = await import("../../assets/cities.json");
  const catalogue = decodeCities(data);
  expect(catalogue).toHaveLength(data.length);
  expect(searchCities(catalogue, "London GB")[0]).toMatchObject({
    latitude: 51.507,
    longitude: -0.128,
  });
  expect(searchCities(catalogue, "London Canada")[0]).toMatchObject({
    latitude: 42.984,
    longitude: -81.25,
  });
});

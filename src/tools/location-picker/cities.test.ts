import { expect, it } from "vitest";
import { decodeCities, distanceKm, rankCities, searchCities } from "./cities.ts";

const cities = decodeCities([
  ["São Paulo", "BR", "São Paulo", -23.55, -46.634],
  ["London", "GB", "London, City of", 51.507, -0.128],
  ["London", "CA", "Ontario", 42.984, -81.25],
  ["Sydney", "AU", "New South Wales", -33.868, 151.21],
]);

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

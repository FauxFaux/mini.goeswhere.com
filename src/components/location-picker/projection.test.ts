import { expect, it } from "vitest";
import { locationToPoint, moveLocation, pointToLocation } from "./projection.ts";

// Reference values evaluated from the upstream raw functions at revision
// 39b53021abbfd530ab9da86f98d634cede88cae4, with this raster's scale and translation.
it.each([
  [-123.12, 49.28, 371.33041246565324, 171.7338576348704],
  [-74.006, 40.7128, 573.5384606779221, 219.0679511111111],
  [-0.1278, 51.5074, 1084.7494272885276, 159.88502490558488],
  [139.6917, 35.6895, 1704.508072605693, 247.561225],
  [151.2093, -33.8688, 1875.9039568176406, 642.11136],
  [-58.3816, -34.6037, 696.2226596960061, 646.2798761111111],
  [18.4241, -33.9249, 1135.0272523583424, 642.4295716666667],
  [-170, -65, 91.76827344845572, 806.8819638266611],
  [-100.001, -60, 319.7244078007475, 783.2405474271238],
  [-99.999, -60, 556.481126002843, 783.2405474271238],
  [29, 40.736, 1194.8686851402986, 218.9363555555556],
  [29, 40.737, 1194.8687415834477, 218.93068336299177],
])("matches upstream at (%s°, %s°)", (longitude, latitude, x, y) => {
  const point = locationToPoint({ latitude, longitude });
  expect(point[0]).toBeCloseTo(x, 8);
  expect(point[1]).toBeCloseTo(y, 8);
  const restored = pointToLocation(x, y)!;
  expect(restored.longitude).toBeCloseTo(longitude, 6);
  expect(restored.latitude).toBeCloseTo(latitude, 6);
});

it("handles exact poles and antimeridian points", () => {
  for (const latitude of [-90, 90]) {
    const meridians = latitude > 0 ? [-100, 30] : [-160, -60, 20, 140];
    for (const longitude of meridians) {
      const restored = pointToLocation(...locationToPoint({ latitude, longitude }))!;
      expect(restored.latitude).toBe(latitude);
      expect(restored.longitude).toBeCloseTo(longitude, 6);
    }
  }
  for (const longitude of [-180, 180]) {
    for (const latitude of [-60, 0, 60]) {
      const restored = pointToLocation(...locationToPoint({ latitude, longitude }))!;
      expect(restored.longitude).toBeCloseTo(longitude, 6);
      expect(restored.latitude).toBeCloseTo(latitude, 6);
    }
  }
});

it.each([
  [0, 0, 1029, 450],
  [-180, 0, 8, 450],
  [180, 0, 2050, 450],
  [-100, 30, 462, 280],
  [30, 60, 1199, 117],
  [-100, 90, 462, 8],
  [30, 90, 1199, 8],
  [-160, -90, 121, 892],
  [-60, -90, 689, 892],
  [20, -90, 1142, 892],
  [140, -90, 1823, 892],
])("aligns raster anchor (%s°, %s°) within a pixel", (longitude, latitude, x, y) => {
  const point = locationToPoint({ latitude, longitude });
  expect(Math.abs(point[0] - x)).toBeLessThan(1);
  expect(Math.abs(point[1] - y)).toBeLessThan(1);
});

it("round trips a global grid across all lobes and both projection regions", () => {
  for (let latitude = -89; latitude <= 89; latitude += 2) {
    for (let longitude = -179; longitude <= 179; longitude += 2) {
      const point = locationToPoint({ latitude, longitude });
      const result = pointToLocation(...point);
      expect(result, `${latitude}, ${longitude}`).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(latitude, 6);
      expect(result!.longitude).toBeCloseTo(longitude, 6);
    }
  }
});

it("round trips near both sides of every interruption", () => {
  for (const [cut, latitude] of [
    [-40, 60],
    [-100, -60],
    [-20, -60],
    [80, -60],
  ]) {
    for (const offset of [-0.0001, 0.0001]) {
      const location = { latitude, longitude: cut + offset };
      const result = pointToLocation(...locationToPoint(location));
      expect(result!.latitude).toBeCloseTo(latitude, 6);
      expect(result!.longitude).toBeCloseTo(location.longitude, 6);
    }
  }
});

it.each([
  [800, 100],
  [460, 800],
  [915, 800],
  [1482, 800],
  [0, 0],
  [1029, 899],
  [-1, 450],
  [2059, 450],
  [NaN, 0],
  [0, Infinity],
])("rejects gaps and invalid pixels (%s, %s)", (x, y) => {
  expect(pointToLocation(x, y)).toBeNull();
});

it("wraps keyboard longitude, clamps latitude, and avoids decimal drift", () => {
  expect(moveLocation({ latitude: 89.9, longitude: 179.9 }, 1, 1)).toEqual({
    latitude: 90,
    longitude: -179.1,
  });
  expect(moveLocation({ latitude: -90, longitude: -180 }, -1, -1)).toEqual({
    latitude: -90,
    longitude: 179,
  });
  expect(moveLocation({ latitude: 0.2, longitude: 0.2 }, 0.1, 0.1)).toEqual({
    latitude: 0.3,
    longitude: 0.3,
  });
});

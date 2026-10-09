import { expect, it } from "vitest";
import { Texture, Vector3 } from "three";
import { observerFrame, scale } from "./astronomy.ts";
import { createHorizonEarth } from "./scene.ts";

it.each([
  { latitude: 51.5074, longitude: -0.1278 },
  { latitude: -33.86, longitude: 151.2 },
  { latitude: 0, longitude: 180 },
  { latitude: 90, longitude: 45 },
  { latitude: -90, longitude: -180 },
])(
  "puts the selected geographic point on top of Earth, tangent to the local horizon: %j",
  (location) => {
    const frame = observerFrame(location);
    const texture = new Texture();
    const earth = createHorizonEarth(texture, frame);
    const radius = earth.geometry.parameters.radius;
    // These are positions in the same geographic frame as the globe's texture UVs.
    const observer = earth.localToWorld(new Vector3(...scale(frame.up, radius)));
    expect(observer.length()).toBeLessThan(1e-12);
    const centre = earth.localToWorld(new Vector3());
    expect(centre.toArray()).toEqual([0, -radius, 0]);
    const localUp = new Vector3(...frame.up).transformDirection(earth.matrixWorld);
    const localNorth = new Vector3(...frame.north).transformDirection(earth.matrixWorld);
    const localEast = new Vector3(...frame.east).transformDirection(earth.matrixWorld);
    expect(localUp.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-12);
    expect(localNorth.distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-12);
    expect(localEast.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-12);
    // Every point on the globe is beneath the observer's tangent plane.
    const vertices = earth.geometry.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      const position = earth.localToWorld(new Vector3().fromBufferAttribute(vertices, i));
      expect(position.y).toBeLessThanOrEqual(1e-7);
    }
    earth.geometry.dispose();
    earth.material.dispose();
    texture.dispose();
  },
);

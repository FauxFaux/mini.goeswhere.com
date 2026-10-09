// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { earthMoonSnapshot, lunarOrbit, earthRadiusKm, moonRadiusKm, scale } from "./astronomy.ts";
import { createEarthMoonContent } from "./scene-content.ts";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

const date = new Date("2026-10-09T12:00:00Z");
const location = { latitude: 51.5, longitude: -0.1 };
const initial = earthMoonSnapshot(date, location);
const orbit = lunarOrbit(date);

function resources(group: THREE.Group) {
  return group.children.map((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      return {
        object,
        geometry: object.geometry,
        material: object.material,
        position: object.geometry.getAttribute("position"),
        distance: object.geometry.getAttribute("lineDistance"),
      };
    }
    if (object instanceof THREE.Sprite) {
      return { object, material: object.material, map: object.material.map };
    }
    throw new Error("Unexpected scene object");
  });
}

it.each([false, true])(
  "reuses every object, geometry, material, texture and line buffer during playback (sky=%s)",
  (sky) => {
    const earthTexture = new THREE.Texture();
    const moonTexture = new THREE.Texture();
    const content = createEarthMoonContent(
      sky,
      earthTexture,
      moonTexture,
      initial.frame,
      orbit.length,
    );
    content.update(initial, orbit, false);
    const before = resources(content.group);
    const disposal = vi.fn();
    for (const resource of before) {
      if (resource.geometry && !(resource.object instanceof THREE.Sprite))
        resource.geometry.addEventListener("dispose", disposal);
      const material = resource.material;
      if (Array.isArray(material)) throw new Error("Unexpected multi-material object");
      material.addEventListener("dispose", disposal);
      if (resource.map) resource.map.addEventListener("dispose", disposal);
    }
    const externalDisposal = vi.fn();
    earthTexture.addEventListener("dispose", externalDisposal);
    moonTexture.addEventListener("dispose", externalDisposal);
    for (let i = 0; i < 20; i++) {
      const nextDate = new Date(date.getTime() + i * 3600000);
      const next = earthMoonSnapshot(nextDate, { latitude: -33.86, longitude: 151.2 });
      content.update(
        { ...next, geometricMoonAltitude: i % 2 ? -10 : 10 },
        lunarOrbit(nextDate),
        i % 2 === 0,
      );
      const after = resources(content.group);
      expect(after.length).toBe(before.length);
      for (let j = 0; j < before.length; j++) {
        for (const key of [
          "object",
          "geometry",
          "material",
          "position",
          "distance",
          "map",
        ] as const) {
          expect(after[j]![key]).toBe(before[j]![key]);
        }
      }
    }
    expect(disposal).not.toHaveBeenCalled();
    // Solid and dashed sight lines share geometry, with exactly one visible.
    const sightLines = content.group.children
      .filter(
        (object): object is THREE.Line =>
          object instanceof THREE.Line &&
          object.material instanceof THREE.LineBasicMaterial &&
          object.material.color.getHex() === 0xffe09a,
      )
      .slice(0, 2);
    expect(sightLines[0]!.geometry).toBe(sightLines[1]!.geometry);
    expect(sightLines.map((line) => line.visible)).toEqual([false, true]);
    const geometry = sightLines[0]!.geometry;
    const distance = geometry.getAttribute("lineDistance");
    const position = geometry.getAttribute("position");
    const length = new THREE.Vector3()
      .fromBufferAttribute(position, 0)
      .distanceTo(new THREE.Vector3().fromBufferAttribute(position, 1));
    expect(distance.getX(0)).toBe(0);
    expect(distance.getX(1)).toBeCloseTo(length, 5);
    content.dispose();
    const uniqueGeometries = new Set(
      before.flatMap((resource) => (resource.geometry ? [resource.geometry] : [])),
    );
    expect(disposal).toHaveBeenCalledTimes(
      uniqueGeometries.size + before.length + before.filter((resource) => resource.map).length,
    );
    expect(externalDisposal).not.toHaveBeenCalled();
  },
);

it("updates physical scale, orbit bounds, lunar facing and observer position without changing camera-independent resources", () => {
  const content = createEarthMoonContent(
    false,
    new THREE.Texture(),
    new THREE.Texture(),
    initial.frame,
    orbit.length,
  );
  const meshes = content.group.children.filter(
    (object): object is THREE.Mesh<THREE.SphereGeometry> => object instanceof THREE.Mesh,
  );
  const moon = meshes.find(
    (mesh) => mesh.geometry.parameters.radius === moonRadiusKm / earthRadiusKm,
  )!;
  const observer = meshes.find((mesh) => mesh.geometry.parameters.radius === 0.04)!;
  const sun = meshes.find((mesh) => mesh.geometry.parameters.radius === 0.3)!;
  const path = content.group.children.find(
    (object): object is THREE.Line =>
      object instanceof THREE.Line &&
      object.geometry.getAttribute("position").count === orbit.length,
  )!;
  content.update(initial, orbit, false);
  const compressedRadius = path.geometry.boundingSphere!.radius;
  const compressedPoint = scale(initial.moonPosition, 4 / (384400 / earthRadiusKm));
  expect(moon.position.toArray()).toEqual(compressedPoint);
  expect(sun.scale.x).toBe(1);
  content.update(initial, orbit, true);
  expect(moon.position.toArray()).toEqual(initial.moonPosition);
  expect(moon.rotation.y).toBe(
    Math.atan2(-initial.moonPosition[2], initial.moonPosition[0]) + Math.PI,
  );
  expect(observer.position.toArray()).toEqual(scale(initial.frame.up, 1.008));
  expect(sun.scale.x).toBe(2);
  expect(path.geometry.boundingSphere!.radius).toBeGreaterThan(compressedRadius * 14);
  content.dispose();
});

it("updates the horizon Earth's geographic orientation when location changes", () => {
  const content = createEarthMoonContent(
    true,
    new THREE.Texture(),
    new THREE.Texture(),
    initial.frame,
    orbit.length,
  );
  const next = earthMoonSnapshot(date, { latitude: -33.86, longitude: 151.2 });
  content.update(next, orbit, false);
  const earth = content.group.children[0] as THREE.Mesh;
  earth.updateMatrixWorld();
  const observerPoint = earth.localToWorld(new THREE.Vector3(...scale(next.frame.up, 1.2)));
  expect(observerPoint.length()).toBeLessThan(1e-12);
  expect(
    new THREE.Vector3(...next.frame.north)
      .transformDirection(earth.matrixWorld)
      .distanceTo(new THREE.Vector3(0, 0, -1)),
  ).toBeLessThan(1e-12);
  content.dispose();
});

import * as THREE from "three";
import {
  add,
  dot,
  scale,
  unit,
  earthRadiusKm,
  moonRadiusKm,
  type Vector,
  type earthMoonSnapshot,
} from "./astronomy.ts";

type Snapshot = ReturnType<typeof earthMoonSnapshot>;
type Measure = <T>(phase: string, calculate: () => T) => T;
const red = 0xff6262;
const yellow = 0xffe09a;
const blue = 0x91bfff;
const compressedMoonDistance = 4;
const origin: Vector = [0, 0, 0];
const vec = (point: Vector) => new THREE.Vector3(...point);

function ringPoints(center: Vector, north: Vector, east: Vector, radius: number) {
  return Array.from({ length: 97 }, (_, i) => {
    const angle = (i * Math.PI) / 48;
    return add(
      center,
      add(scale(north, radius * Math.cos(angle)), scale(east, radius * Math.sin(angle))),
    );
  });
}

function orientHorizonEarth(earth: THREE.Mesh, { up, north, east }: Snapshot["frame"]) {
  const earthToLocal = new THREE.Matrix4()
    .makeBasis(vec(east), vec(up), vec(scale(north, -1)))
    .transpose();
  earth.quaternion.setFromRotationMatrix(earthToLocal);
}

/** Geographic texture in local ENU coordinates, with the observer at the globe's top. */
export function createHorizonEarth(texture: THREE.Texture, frame: Snapshot["frame"]) {
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 64, 32),
    new THREE.MeshLambertMaterial({
      map: texture,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  earth.position.set(0, -1.2, 0);
  orientHorizonEarth(earth, frame);
  return earth;
}

/** Persistent scene resources. Only transforms and dynamic line attributes change on playback. */
export function createEarthMoonContent(
  sky: boolean,
  earthTexture: THREE.Texture,
  moonTexture: THREE.Texture,
  frame: Snapshot["frame"],
  orbitCount: number,
  measure: Measure = (_phase, calculate) => calculate(),
) {
  const group = new THREE.Group();
  const sunlightPosition = new THREE.Vector3();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const labelTextures = new Set<THREE.Texture>();
  function ownMaterial<T extends THREE.Material>(material: T): T {
    materials.add(material);
    return material;
  }
  function sphere(radius: number, position: Vector, material: THREE.Material) {
    return measure("Spheres", () => {
      const geometry = new THREE.SphereGeometry(radius, 64, 32);
      geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, ownMaterial(material));
      mesh.position.set(...position);
      group.add(mesh);
      return mesh;
    });
  }
  function label(text: string, position: Vector, size = 0.3) {
    return measure("Labels", () => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const context = canvas.getContext("2d");
      if (!context) return undefined;
      context.font = "32px system-ui";
      context.fillStyle = "#e3e5e8";
      context.textAlign = "center";
      context.fillText(text, 128, 42);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      labelTextures.add(texture);
      const sprite = new THREE.Sprite(
        ownMaterial(new THREE.SpriteMaterial({ map: texture, depthTest: false })),
      );
      sprite.position.set(...position);
      sprite.scale.set(size * 4, size, 1);
      group.add(sprite);
      return sprite;
    });
  }
  function line(
    points: Vector[],
    color: number,
    {
      dashed = false,
      switchable = false,
      dynamic = true,
    }: { dashed?: boolean; switchable?: boolean; dynamic?: boolean } = {},
  ) {
    return measure("Lines", () => {
      const geometry = new THREE.BufferGeometry();
      geometries.add(geometry);
      const solidMaterial =
        !dashed || switchable ? ownMaterial(new THREE.LineBasicMaterial({ color })) : undefined;
      const dashedMaterial =
        dashed || switchable
          ? ownMaterial(new THREE.LineDashedMaterial({ color, dashSize: 0.09, gapSize: 0.06 }))
          : undefined;
      const solid = solidMaterial ? new THREE.Line(geometry, solidMaterial) : undefined;
      const dashedLine = dashedMaterial ? new THREE.Line(geometry, dashedMaterial) : undefined;
      if (solid) group.add(solid);
      if (dashedLine) group.add(dashedLine);
      const set = (next: Vector[], useDashes = dashed) => {
        let positions = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
        if (!positions || positions.count !== next.length) {
          positions = new THREE.BufferAttribute(new Float32Array(next.length * 3), 3);
          if (dynamic) positions.setUsage(THREE.DynamicDrawUsage);
          geometry.setAttribute("position", positions);
          if (dashedMaterial) {
            const distances = new THREE.BufferAttribute(new Float32Array(next.length), 1);
            if (dynamic) distances.setUsage(THREE.DynamicDrawUsage);
            geometry.setAttribute("lineDistance", distances);
          }
        }
        const distances = geometry.getAttribute("lineDistance") as
          | THREE.BufferAttribute
          | undefined;
        let distance = 0;
        for (let i = 0; i < next.length; i++) {
          const point = next[i]!;
          positions.setXYZ(i, ...point);
          if (distances) {
            if (i > 0) {
              const previous = next[i - 1]!;
              distance += Math.hypot(
                point[0] - previous[0],
                point[1] - previous[1],
                point[2] - previous[2],
              );
            }
            distances.setX(i, distance);
          }
        }
        positions.needsUpdate = true;
        if (distances) distances.needsUpdate = true;
        geometry.computeBoundingSphere();
        if (solid) solid.visible = !useDashes;
        if (dashedLine) dashedLine.visible = useDashes;
      };
      set(points);
      return set;
    });
  }

  const earth = sky
    ? measure("Spheres", () => {
        const mesh = createHorizonEarth(earthTexture, frame);
        geometries.add(mesh.geometry);
        ownMaterial(mesh.material);
        group.add(mesh);
        return mesh;
      })
    : sphere(1, origin, new THREE.MeshLambertMaterial({ map: earthTexture }));
  const observer = sphere(sky ? 0.045 : 0.04, origin, new THREE.MeshBasicMaterial({ color: red }));
  const observerLabel = label("Observer", sky ? [0, 0.2, 0] : origin, sky ? 0.18 : 0.15);
  const moon = sphere(
    sky ? 0.12 : moonRadiusKm / earthRadiusKm,
    origin,
    new THREE.MeshLambertMaterial({ map: moonTexture }),
  );
  const moonLabel = label("Moon", origin, sky ? 0.18 : 0.3);
  const sun = sphere(sky ? 0.09 : 0.3, origin, new THREE.MeshBasicMaterial({ color: 0xffc764 }));
  const sunLabel = label(sky ? "Sun" : "Sun direction", origin, sky ? 0.18 : 0.3);
  const sightLine = line([origin, origin], yellow, { switchable: true });
  let updateView: (next: Snapshot, orbit: Vector[], physicalDistance: boolean) => void;
  if (sky) {
    line(ringPoints(origin, [0, 0, -1], [1, 0, 0], 2), red, { dynamic: false });
    for (const bearing of [0, 45, 90, 135]) {
      const angle = THREE.MathUtils.degToRad(bearing);
      line(
        Array.from({ length: 65 }, (_, i): Vector => {
          const t = (i * Math.PI) / 32;
          return [
            2 * Math.sin(angle) * Math.cos(t),
            2 * Math.sin(t),
            -2 * Math.cos(angle) * Math.cos(t),
          ];
        }),
        0x36404e,
        { dynamic: false },
      );
    }
    for (const [text, point] of [
      ["N", [0, 0, -2.3]],
      ["E", [2.3, 0, 0]],
      ["S", [0, 0, 2.3]],
      ["W", [-2.3, 0, 0]],
      ["Zenith", [0, 2.3, 0]],
    ] as [string, Vector][])
      label(text, point);
    const bearingLine = line([origin, origin], red);
    const altitudeLine = line([origin, origin], yellow, { dashed: true });
    updateView = (next) => {
      const { up, north, east } = next.frame;
      const local = (direction: Vector): Vector => [
        dot(direction, east),
        dot(direction, up),
        -dot(direction, north),
      ];
      const moonPoint = scale(local(next.sight), 2);
      const sunPoint = scale(local(next.sunDirection), 2);
      sunlightPosition.set(...scale(local(next.sunDirection), 100));
      orientHorizonEarth(earth, next.frame);
      moon.position.set(...moonPoint);
      moonLabel?.position.set(...add(moonPoint, [0, 0.22, 0]));
      sun.position.set(...sunPoint);
      sunLabel?.position.set(...add(sunPoint, [0, 0.2, 0]));
      sightLine([origin, moonPoint], next.geometricMoonAltitude < 0);
      const horizonPoint: Vector = [
        2 * Math.sin((next.moon.azimuth * Math.PI) / 180),
        0,
        -2 * Math.cos((next.moon.azimuth * Math.PI) / 180),
      ];
      bearingLine([origin, horizonPoint]);
      altitudeLine([horizonPoint, moonPoint]);
    };
  } else {
    const orbitLine = line(
      Array.from({ length: orbitCount }, () => origin),
      0x576579,
    );
    line(
      [
        [0, -1.4, 0],
        [0, 1.4, 0],
      ],
      0x637c9b,
      { dynamic: false },
    );
    label("N", [0, 1.65, 0], 0.2);
    const bearingLine = line([origin, origin], red);
    const horizonLine = line(ringPoints(origin, frame.north, frame.east, 0.6), red);
    const upLine = line([origin, origin], blue);
    const connector = line([origin, origin], yellow, { dashed: true });
    updateView = (next, orbit, physicalDistance) => {
      const { up, north, east } = next.frame;
      sunlightPosition.set(...scale(next.sunDirection, 100));
      const compress = (point: Vector) =>
        physicalDistance ? point : scale(point, compressedMoonDistance / (384400 / earthRadiusKm));
      const moonPoint = compress(next.moonPosition);
      moon.position.set(...moonPoint);
      moon.rotation.y = Math.atan2(-moonPoint[2], moonPoint[0]) + Math.PI;
      moonLabel?.position.set(...add(moonPoint, [0, 0.6, 0]));
      orbitLine(orbit.map(compress));
      const observerPoint = scale(up, 1.008);
      observer.position.set(...observerPoint);
      observerLabel?.position.set(...add(observerPoint, scale(up, 0.23)));
      const bearingDirection = unit(
        add(
          scale(north, Math.cos((next.moon.azimuth * Math.PI) / 180)),
          scale(east, Math.sin((next.moon.azimuth * Math.PI) / 180)),
        ),
      );
      bearingLine([
        add(observerPoint, scale(bearingDirection, -1.3)),
        add(observerPoint, scale(bearingDirection, 1.3)),
      ]);
      horizonLine(ringPoints(observerPoint, north, east, 0.6));
      upLine([observerPoint, add(observerPoint, scale(up, 0.8))]);
      sightLine(
        [observerPoint, add(observerPoint, scale(next.sight, 2))],
        next.geometricMoonAltitude < 0,
      );
      connector([observerPoint, moonPoint]);
      const sunPoint = scale(next.sunDirection, physicalDistance ? 72 : compressedMoonDistance + 1);
      sun.position.set(...sunPoint);
      sun.scale.setScalar(physicalDistance ? 2 : 1);
      sunLabel?.position.set(...add(sunPoint, [0, 0.6, 0]));
    };
  }
  return {
    group,
    sunlightPosition,
    update: updateView,
    dispose() {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      labelTextures.forEach((texture) => texture.dispose());
    },
  };
}

import type { EarthMoonTimings } from "./timings.ts";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import earthMap from "../../assets/tex-earth-day.avif";
import moonMap from "../../assets/tex-moon.avif";
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
export type SceneView = "overview" | "observer";
const red = 0xff6262;
const yellow = 0xffe09a;
const blue = 0x91bfff;
const compressedMoonDistance = 4; // Mean separation in Earth radii.
const vec = (p: Vector) => new THREE.Vector3(...p);

function disposeGroup(group: THREE.Object3D) {
  group.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Sprite
    ) {
      // Sprite geometry is shared internally by Three.js; only dispose our own geometry.
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.SpriteMaterial) material.map?.dispose();
        material.dispose();
      }
    }
  });
}

function buildLine(group: THREE.Group, points: Vector[], color: number, dashed = false) {
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.09, gapSize: 0.06 })
    : new THREE.LineBasicMaterial({ color });
  const object = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points.map(vec)),
    material,
  );
  object.computeLineDistances();
  group.add(object);
}

function buildLabel(group: THREE.Group, text: string, position: Vector, size = 0.3) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.font = "32px system-ui";
  context.fillStyle = "#e3e5e8";
  context.textAlign = "center";
  context.fillText(text, 128, 42);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.position.copy(vec(position));
  sprite.scale.set(size * 4, size, 1);
  group.add(sprite);
}

function buildSphere(
  group: THREE.Group,
  radius: number,
  position: Vector,
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), material);
  mesh.position.copy(vec(position));
  group.add(mesh);
  return mesh;
}

function ringPoints(center: Vector, north: Vector, east: Vector, radius: number) {
  return Array.from({ length: 97 }, (_, i) => {
    const angle = (i * Math.PI) / 48;
    return add(
      center,
      add(scale(north, radius * Math.cos(angle)), scale(east, radius * Math.sin(angle))),
    );
  });
}

/** A schematic globe under the observer, expressed in the local sky's ENU frame.
 * Rotate the geographic texture with the globe: the GPS position becomes its top,
 * with geographic north towards the compass's N and east towards E. */
export function createHorizonEarth(texture: THREE.Texture, { up, north, east }: Snapshot["frame"]) {
  const radius = 1.2;
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 32),
    new THREE.MeshLambertMaterial({
      map: texture,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  earth.position.set(0, -radius, 0);
  const earthToLocal = new THREE.Matrix4()
    .makeBasis(vec(east), vec(up), vec(scale(north, -1)))
    .transpose();
  earth.quaternion.setFromRotationMatrix(earthToLocal);
  return earth;
}

/** One demand-rendered canvas. All WebGL resources and subscriptions belong to its mount. */
export function createEarthMoonScene(
  canvas: HTMLCanvasElement,
  sky: boolean,
  onError: (message: string) => void,
  timings?: EarthMoonTimings,
) {
  const measure = <T>(phase: string, calculate: () => T): T =>
    timings ? timings.measure(`${sky ? "Sky" : "Space"}: ${phase}`, calculate) : calculate();
  const sphere = (...args: Parameters<typeof buildSphere>) =>
    measure("Spheres", () => buildSphere(...args));
  const line = (...args: Parameters<typeof buildLine>) =>
    measure("Lines", () => buildLine(...args));
  const label = (...args: Parameters<typeof buildLabel>) =>
    measure("Labels", () => buildLabel(...args));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(0x111418);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = sky ? 2.6 : 1.4;
  controls.maxDistance = sky ? 10 : 300;
  const sunlight = new THREE.DirectionalLight(0xffffff, 2.5);
  scene.add(sunlight, new THREE.AmbientLight(0xffffff, 0.08));
  let content = new THREE.Group();
  scene.add(content);
  let active = true;
  let snapshot: Snapshot | undefined;
  let trueDistance = false;
  let view: SceneView = "overview";
  let previousScale: boolean | undefined;
  const textures: THREE.Texture[] = [];

  function render() {
    if (!active) return;
    try {
      measure("Resize / projection", () => {
        const width = Math.max(1, canvas.clientWidth);
        const height = Math.max(1, canvas.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      });
      measure("Render", () => renderer.render(scene, camera));
    } catch {
      onError("The 3D view could not be rendered. The sky bearings are still available below.");
    }
  }
  const loader = new THREE.TextureLoader();
  function loadTexture(url: string) {
    const texture = loader.load(
      url,
      () => {
        if (!active) {
          texture.dispose();
          return;
        }
        render();
      },
      undefined,
      () => {
        if (active) onError("A reference texture could not be loaded. Try reloading this page.");
      },
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.push(texture);
    return texture;
  }
  const earthTexture = loadTexture(earthMap);
  const moonTexture = loadTexture(moonMap);

  function reset(nextView: SceneView = "overview") {
    view = nextView;
    if (!snapshot) return;
    if (sky) {
      controls.target.set(0, -0.2, 0);
      camera.position.set(4, 3, 4);
    } else if (view === "observer") {
      controls.target.copy(vec(scale(snapshot.frame.up, 0.8)));
      camera.position.copy(
        vec(
          add(
            scale(snapshot.frame.up, 3.3),
            add(scale(snapshot.frame.north, -1.1), scale(snapshot.frame.east, 1.8)),
          ),
        ),
      );
    } else {
      controls.target.set(0, 0, 0);
      const orbitRadius = trueDistance ? 65 : compressedMoonDistance + 0.5;
      const distance = (orbitRadius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.15;
      camera.position.copy(
        vec(
          scale(
            unit(
              add(
                snapshot.frame.up,
                add(scale(snapshot.frame.north, 0.5), scale(snapshot.frame.east, 0.8)),
              ),
            ),
            distance,
          ),
        ),
      );
    }
    controls.update();
    render();
  }

  function update(next: Snapshot, orbit: Vector[], physicalDistance: boolean) {
    measure("Update", () => {
      snapshot = next;
      trueDistance = physicalDistance;
      measure("Dispose", () => disposeGroup(content));
      measure("Build", () => {
        scene.remove(content);
        content = new THREE.Group();
        scene.add(content);
        const { up, north, east } = next.frame;
        if (sky) {
          // Local ENU frame: +X east, +Y zenith, −Z north.
          const local = (direction: Vector): Vector => [
            dot(direction, east),
            dot(direction, up),
            -dot(direction, north),
          ];
          const origin: Vector = [0, 0, 0];
          const moonPoint = scale(local(next.sight), 2);
          const sunPoint = scale(local(next.sunDirection), 2);
          sunlight.position.copy(vec(scale(local(next.sunDirection), 100)));
          // Keep depth writes off so below-horizon objects and sight lines remain visible
          // through the explanatory Earth volume rather than disappearing behind it.
          content.add(measure("Spheres", () => createHorizonEarth(earthTexture, next.frame)));
          line(content, ringPoints(origin, [0, 0, -1], [1, 0, 0], 2), red);
          for (const bearing of [0, 45, 90, 135]) {
            const angle = THREE.MathUtils.degToRad(bearing);
            const arc = Array.from({ length: 65 }, (_, i): Vector => {
              const t = (i * Math.PI) / 32;
              return [
                2 * Math.sin(angle) * Math.cos(t),
                2 * Math.sin(t),
                -2 * Math.cos(angle) * Math.cos(t),
              ];
            });
            line(content, arc, 0x36404e);
          }
          for (const [text, point] of [
            ["N", [0, 0, -2.3]],
            ["E", [2.3, 0, 0]],
            ["S", [0, 0, 2.3]],
            ["W", [-2.3, 0, 0]],
            ["Zenith", [0, 2.3, 0]],
          ] as [string, Vector][])
            label(content, text, point);
          sphere(content, 0.045, origin, new THREE.MeshBasicMaterial({ color: red }));
          label(content, "Observer", [0, 0.2, 0], 0.18);
          sphere(content, 0.12, moonPoint, new THREE.MeshLambertMaterial({ map: moonTexture }));
          label(content, "Moon", add(moonPoint, [0, 0.22, 0]), 0.18);
          sphere(content, 0.09, sunPoint, new THREE.MeshBasicMaterial({ color: 0xffc764 }));
          label(content, "Sun", add(sunPoint, [0, 0.2, 0]), 0.18);
          line(content, [origin, moonPoint], yellow, next.geometricMoonAltitude < 0);
          const horizonPoint: Vector = [
            2 * Math.sin((next.moon.azimuth * Math.PI) / 180),
            0,
            -2 * Math.cos((next.moon.azimuth * Math.PI) / 180),
          ];
          line(content, [origin, horizonPoint], red);
          line(content, [horizonPoint, moonPoint], yellow, true);
        } else {
          sunlight.position.copy(vec(scale(next.sunDirection, 100)));
          sphere(content, 1, [0, 0, 0], new THREE.MeshLambertMaterial({ map: earthTexture }));
          // Physical radii, with optional radial compression of the Moon's distance only.
          const compress = (point: Vector) =>
            trueDistance ? point : scale(point, compressedMoonDistance / (384400 / earthRadiusKm));
          const moonPoint = compress(next.moonPosition);
          const moon = sphere(
            content,
            moonRadiusKm / earthRadiusKm,
            moonPoint,
            new THREE.MeshLambertMaterial({ map: moonTexture }),
          );
          // Approximate synchronous facing; lunar libration and axial orientation are omitted.
          moon.rotation.y = Math.atan2(-moonPoint[2], moonPoint[0]) + Math.PI;
          label(content, "Moon", add(moonPoint, [0, 0.6, 0]));
          line(content, orbit.map(compress), 0x576579);
          line(
            content,
            [
              [0, -1.4, 0],
              [0, 1.4, 0],
            ],
            0x637c9b,
          );
          label(content, "N", [0, 1.65, 0], 0.2);
          const observer = scale(up, 1.008);
          sphere(content, 0.04, observer, new THREE.MeshBasicMaterial({ color: red }));
          label(content, "Observer", add(observer, scale(up, 0.23)), 0.15);
          const bearingDirection = unit(
            add(
              scale(north, Math.cos((next.moon.azimuth * Math.PI) / 180)),
              scale(east, Math.sin((next.moon.azimuth * Math.PI) / 180)),
            ),
          );
          line(
            content,
            [
              add(observer, scale(bearingDirection, -1.3)),
              add(observer, scale(bearingDirection, 1.3)),
            ],
            red,
          );
          line(content, ringPoints(observer, north, east, 0.6), red);
          line(content, [observer, add(observer, scale(up, 0.8))], blue);
          // The short ray always preserves the true viewing altitude, even in compressed mode.
          line(
            content,
            [observer, add(observer, scale(next.sight, 2))],
            yellow,
            next.geometricMoonAltitude < 0,
          );
          line(content, [observer, moonPoint], yellow, true);
          const sunPoint = scale(next.sunDirection, trueDistance ? 72 : compressedMoonDistance + 1);
          sphere(
            content,
            trueDistance ? 0.6 : 0.3,
            sunPoint,
            new THREE.MeshBasicMaterial({ color: 0xffc764 }),
          );
          label(content, "Sun direction", add(sunPoint, [0, 0.6, 0]));
        }
      });
      if (previousScale === undefined || previousScale !== trueDistance) reset(view);
      previousScale = trueDistance;
      render();
    });
  }

  const resize = new ResizeObserver(render);
  resize.observe(canvas);
  controls.addEventListener("change", render);
  controls.listenToKeyEvents(canvas);
  const lost = (event: Event) => {
    event.preventDefault();
    onError("The WebGL context was lost. Reload to restore the 3D view.");
  };
  canvas.addEventListener("webglcontextlost", lost);
  return {
    update,
    reset,
    dispose() {
      active = false;
      resize.disconnect();
      controls.dispose();
      canvas.removeEventListener("webglcontextlost", lost);
      disposeGroup(content);
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

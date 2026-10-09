import { createEarthMoonContent } from "./scene-content.ts";
export { createHorizonEarth } from "./scene-content.ts";
import type { EarthMoonTimings } from "./timings.ts";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import earthMap from "../../assets/tex-earth-day.avif";
import moonMap from "../../assets/tex-moon.avif";
import { add, scale, unit, type Vector, type earthMoonSnapshot } from "./astronomy.ts";

type Snapshot = ReturnType<typeof earthMoonSnapshot>;
export type SceneView = "overview" | "observer";
const compressedMoonDistance = 4; // Mean separation in Earth radii.
const vec = (p: Vector) => new THREE.Vector3(...p);

/** One demand-rendered canvas. All WebGL resources and subscriptions belong to its mount. */
export function createEarthMoonScene(
  canvas: HTMLCanvasElement,
  sky: boolean,
  onError: (message: string) => void,
  timings?: EarthMoonTimings,
) {
  const measure = <T>(phase: string, calculate: () => T): T =>
    timings ? timings.measure(`${sky ? "Sky" : "Space"}: ${phase}`, calculate) : calculate();
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
  let content: ReturnType<typeof createEarthMoonContent> | undefined;
  let updating = false;
  let renderedWidth = 0;
  let renderedHeight = 0;
  let renderedPixelRatio = 0;
  let active = true;
  let snapshot: Snapshot | undefined;
  let trueDistance = false;
  let view: SceneView = "overview";
  let previousScale: boolean | undefined;
  const textures: THREE.Texture[] = [];

  function render() {
    if (!active || updating) return;
    try {
      measure("Resize / projection", () => {
        const width = Math.max(1, canvas.clientWidth);
        const height = Math.max(1, canvas.clientHeight);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        if (
          width !== renderedWidth ||
          height !== renderedHeight ||
          pixelRatio !== renderedPixelRatio
        ) {
          renderer.setPixelRatio(pixelRatio);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderedWidth = width;
          renderedHeight = height;
          renderedPixelRatio = pixelRatio;
        }
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
    const wasUpdating = updating;
    updating = true;
    try {
      controls.update();
    } finally {
      updating = wasUpdating;
    }
    render();
  }

  function update(next: Snapshot, orbit: Vector[], physicalDistance: boolean) {
    measure("Update", () => {
      snapshot = next;
      trueDistance = physicalDistance;
      updating = true;
      try {
        if (!content) {
          content = measure("Build", () =>
            createEarthMoonContent(
              sky,
              earthTexture,
              moonTexture,
              next.frame,
              orbit.length,
              measure,
            ),
          );
          scene.add(content.group);
        }
        measure("Transform", () => content!.update(next, orbit, physicalDistance));
        sunlight.position.copy(content.sunlightPosition);
        if (previousScale === undefined || previousScale !== trueDistance) reset(view);
        previousScale = trueDistance;
      } finally {
        updating = false;
      }
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
      if (content) measure("Dispose", () => content!.dispose());
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

import type { EarthMoonTimings } from "./timings.ts";
import { useEffect, useRef, useState } from "preact/hooks";
import type { earthMoonSnapshot, Vector } from "./astronomy.ts";
import type { createEarthMoonScene, SceneView } from "./scene.ts";

let sceneModule: Promise<typeof import("./scene.ts")> | undefined;
function loadScene() {
  return (sceneModule ??= import("./scene.ts"));
}

/** Independent of URL transport: can also be mounted with a clock's location and instant. */
export function EarthMoonView({
  timings,
  snapshot,
  orbit,
  trueDistance,
  sky = false,
}: {
  timings?: EarthMoonTimings;
  snapshot: ReturnType<typeof earthMoonSnapshot>;
  orbit: Vector[];
  trueDistance: boolean;
  sky?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<ReturnType<typeof createEarthMoonScene>>();
  const latest = useRef({ snapshot, orbit, trueDistance });
  latest.current = { snapshot, orbit, trueDistance };
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    let scene: ReturnType<typeof createEarthMoonScene> | undefined;
    void loadScene()
      .then(({ createEarthMoonScene }) => {
        if (disposed || !canvas.current) return;
        try {
          scene = createEarthMoonScene(canvas.current, sky, setError, timings);
          controller.current = scene;
          const value = latest.current;
          scene.update(value.snapshot, value.orbit, value.trueDistance);
          setReady(true);
        } catch {
          scene?.dispose();
          scene = undefined;
          controller.current = undefined;
          setError("The 3D view needs WebGL. The sky bearings are still available below.");
        }
      })
      .catch(() => {
        if (!disposed) setError("The 3D view could not load. Try reloading this page.");
      });
    return () => {
      disposed = true;
      controller.current = undefined;
      scene?.dispose();
    };
  }, [sky, timings]);
  useEffect(() => {
    controller.current?.update(snapshot, orbit, trueDistance);
  }, [snapshot, orbit, trueDistance]);

  const reset = (view: SceneView) => controller.current?.reset(view);
  return (
    <section
      class={`earth-moon-view earth-moon-view-${sky ? "sky" : "space"}`}
      aria-label={sky ? "Local sky" : "Earth and Moon in space"}
    >
      <canvas
        ref={canvas}
        tabIndex={0}
        aria-label={
          sky
            ? "Rotatable local sky with a translucent Earth beneath your location, compass directions, Sun and Moon"
            : "Rotatable textured Earth, observer tangent, lunar orbit and sunlight direction"
        }
        aria-describedby="earth-moon-view-help"
      />
      {error ? (
        <p role="alert" class="error">
          {error}
        </p>
      ) : (
        !ready && <p role="status">Loading 3D view…</p>
      )}
      <section
        class="earth-moon-camera-controls"
        aria-label={sky ? "Horizon camera controls" : "Earth and Moon camera controls"}
      >
        <h2>{sky ? "Your horizon" : "Earth and Moon"}</h2>
        <div class="earth-moon-actions">
          <button disabled={!ready} onClick={() => reset("overview")}>
            Reset view
          </button>
          {!sky && (
            <button disabled={!ready} onClick={() => reset("observer")}>
              Observer close-up
            </button>
          )}
        </div>
      </section>
    </section>
  );
}

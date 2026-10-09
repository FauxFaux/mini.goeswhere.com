// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { earthMoonSnapshot, lunarOrbit } from "./astronomy.ts";
import { createEarthMoonScene } from "./scene.ts";
import { EarthMoonTimings } from "./timings.ts";

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  setSize: vi.fn(),
  setPixelRatio: vi.fn(),
  dispose: vi.fn(),
  controlsDispose: vi.fn(),
  disconnect: vi.fn(),
  change: undefined as (() => void) | undefined,
  resize: undefined as (() => void) | undefined,
}));
vi.mock("three", async (importOriginal) => {
  const three = await importOriginal<typeof import("three")>();
  return {
    ...three,
    WebGLRenderer: class {
      capabilities = { getMaxAnisotropy: () => 1 };
      setClearColor() {}
      setPixelRatio = mocks.setPixelRatio;
      setSize = mocks.setSize;
      render = mocks.render;
      dispose = mocks.dispose;
      forceContextLoss() {}
    },
    TextureLoader: class {
      load() {
        return new three.Texture();
      }
    },
  };
});
vi.mock("three/addons/controls/OrbitControls.js", async () => {
  const { Vector3 } = await import("three");
  return {
    OrbitControls: class {
      target = new Vector3();
      update() {
        mocks.change?.();
      }
      addEventListener(_type: string, callback: () => void) {
        mocks.change = callback;
      }
      listenToKeyEvents() {}
      dispose = mocks.controlsDispose;
    },
  };
});
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        mocks.resize = callback;
      }
      observe() {}
      disconnect = mocks.disconnect;
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  mocks.change = undefined;
  mocks.resize = undefined;
});

it.each([false, true])(
  "builds once, renders once per update, resizes only when needed and releases subscriptions (sky=%s)",
  (sky) => {
    const canvas = document.createElement("canvas");
    let width = 640;
    Object.defineProperty(canvas, "clientWidth", { get: () => width });
    Object.defineProperty(canvas, "clientHeight", { value: 480 });
    const timings = new EarthMoonTimings();
    const onError = vi.fn();
    const controller = createEarthMoonScene(canvas, sky, onError, timings);
    const date = new Date("2026-10-09T12:00:00Z");
    const snapshot = earthMoonSnapshot(date, { latitude: 51.5, longitude: -0.1 });
    const orbit = lunarOrbit(date);
    controller.update(snapshot, orbit, false);
    controller.update(snapshot, orbit, false);
    controller.update(snapshot, orbit, true);
    expect(mocks.render).toHaveBeenCalledTimes(3);
    expect(mocks.setSize).toHaveBeenCalledTimes(1);
    expect(mocks.setPixelRatio).toHaveBeenCalledTimes(1);
    const prefix = sky ? "Sky" : "Space";
    expect(timings.read().get(`${prefix}: Build`)?.count).toBe(1);
    expect(timings.read().get(`${prefix}: Transform`)?.count).toBe(3);
    expect(timings.read().has(`${prefix}: Dispose`)).toBe(false);
    controller.reset("observer");
    expect(mocks.render).toHaveBeenCalledTimes(4);
    width = 800;
    mocks.resize!();
    expect(mocks.render).toHaveBeenCalledTimes(5);
    expect(mocks.setSize).toHaveBeenLastCalledWith(800, 480, false);
    expect(mocks.setSize).toHaveBeenCalledTimes(2);
    controller.dispose();
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(mocks.controlsDispose).toHaveBeenCalledOnce();
    expect(timings.read().get(`${prefix}: Dispose`)?.count).toBe(1);
    mocks.resize!();
    mocks.change!();
    expect(mocks.render).toHaveBeenCalledTimes(5);
    expect(onError).not.toHaveBeenCalled();
  },
);

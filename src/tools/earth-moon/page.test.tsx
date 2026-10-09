// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../app.tsx";
import { navigateHash, splitHash } from "../../boot/hash-location.ts";
import * as cityFunctions from "../../components/location-picker/cities.ts";
import { locationToPoint } from "../../components/location-picker/projection.ts";
import { observerFrame } from "./astronomy.ts";
import { earthMoonCodec } from "./state.ts";

const sceneMocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("./scene.ts", () => ({ createEarthMoonScene: sceneMocks.create }));

beforeEach(async () => {
  await import("./scene.ts");
  window.history.replaceState(
    null,
    "",
    "/#/earth-moon?lat=51.5&lon=-0.1&at=2026-10-09T12%3A00%3A00.000Z&note=keep",
  );
  sceneMocks.create.mockImplementation(() => ({
    update: vi.fn(),
    reset: vi.fn(),
    dispose: vi.fn(),
  }));
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn() },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sceneMocks.create.mockReset();
});

function persisted() {
  return earthMoonCodec.query!.decode(new URLSearchParams(splitHash(window.location.hash).search));
}

it("edits coordinates and UTC time, preserves unrelated query state, then restores through Back", async () => {
  const user = userEvent.setup();
  render(<App />);
  const original = window.location.href;
  const length = window.history.length;
  const latitude = screen.getByRole("spinbutton", { name: "Latitude", exact: true });
  const longitude = screen.getByRole("spinbutton", { name: "Longitude", exact: true });
  const date = screen.getByLabelText("Date and time (UTC)") as HTMLInputElement;
  expect(date.value).toBe("2026-10-09T12:00");
  expect(window.location.href).toBe(original);
  await user.clear(latitude);
  await user.type(latitude, "-33.86");
  await user.clear(longitude);
  await user.type(longitude, "151.2");
  fireEvent.input(date, { target: { value: "2026-10-10T06:30:00" } });
  await user.click(screen.getByRole("button", { name: "Update view" }));
  await user.click(screen.getByRole("checkbox", { name: "True Earth–Moon distance scale" }));
  // Navigation flushes pending debounced edits.
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  act(() => window.history.back());
  const restored = await screen.findByRole("spinbutton", { name: "Latitude", exact: true });
  expect((restored as HTMLInputElement).value).toBe("-33.86");
  expect(persisted()).toMatchObject({
    location: { latitude: -33.86, longitude: 151.2 },
    instant: Date.parse("2026-10-10T06:30:00Z"),
    trueDistance: true,
  });
  expect(new URLSearchParams(splitHash(window.location.hash).search).get("note")).toBe("keep");
  expect(window.location.search).toBe("");
  expect(window.history.length).toBe(length + 1);
});

it("scrubs time immediately and discards pending writes when a shared link arrives", async () => {
  render(<App />);
  const slider = screen.getByRole("slider", { name: "Time within this UTC day" });
  fireEvent.keyDown(slider, { key: "Home" });
  fireEvent.keyDown(slider, { key: "PageUp" });
  expect((screen.getByLabelText("Date and time (UTC)") as HTMLInputElement).value).toBe(
    "2026-10-09T00:05",
  );
  const incoming = "#/earth-moon?lat=0&lon=180&at=2026-10-12T18%3A00%3A00.000Z&scale=true";
  act(() => {
    window.location.hash = incoming;
  });
  await waitFor(() =>
    expect(
      (screen.getByRole("spinbutton", { name: "Latitude", exact: true }) as HTMLInputElement).value,
    ).toBe("0"),
  );
  await new Promise((resolve) => setTimeout(resolve, 220));
  expect(window.location.hash).toBe(incoming);
  expect((screen.getByLabelText("Date and time (UTC)") as HTMLInputElement).value).toBe(
    "2026-10-12T18:00",
  );
});

it("updates from GPS and handles denied access locally", async () => {
  const gps = vi.spyOn(navigator.geolocation, "getCurrentPosition");
  let success: PositionCallback | undefined;
  let failure: PositionErrorCallback | null | undefined;
  gps.mockImplementation((ok, fail) => {
    success = ok;
    failure = fail;
  });
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Use my location" }));
  act(() => success!({ coords: { latitude: -33.9, longitude: 151.2 } } as GeolocationPosition));
  expect(
    (screen.getByRole("spinbutton", { name: "Latitude", exact: true }) as HTMLInputElement).value,
  ).toBe("-33.9");
  await user.click(screen.getByRole("button", { name: "Use my location" }));
  act(() => failure!({ code: 1 } as GeolocationPositionError));
  expect(screen.getByRole("alert").textContent).toContain("Location access was declined");
  expect(screen.getByRole("heading", { name: "Earth, Moon and your sky" })).toBeTruthy();
});

it("ignores a late GPS result after another link arrives", async () => {
  let success: PositionCallback | undefined;
  vi.spyOn(navigator.geolocation, "getCurrentPosition").mockImplementation((ok) => {
    success = ok;
  });
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Use my location" }));
  act(() => {
    window.location.hash = "/earth-moon?lat=10&lon=20&at=2026-10-10T00%3A00%3A00.000Z";
  });
  await waitFor(() =>
    expect(
      (screen.getByRole("spinbutton", { name: "Latitude", exact: true }) as HTMLInputElement).value,
    ).toBe("10"),
  );
  act(() => success!({ coords: { latitude: -33.9, longitude: 151.2 } } as GeolocationPosition));
  expect(
    (screen.getByRole("spinbutton", { name: "Latitude", exact: true }) as HTMLInputElement).value,
  ).toBe("10");
});

it("preserves invalid links and offers recovery", async () => {
  window.history.replaceState(null, "", "/#/earth-moon?lat=91&lon=0");
  const original = window.location.href;
  render(<App />);
  expect(screen.getByRole("heading", { name: "Corrupt URL state" })).toBeTruthy();
  expect(window.location.href).toBe(original);
  await userEvent.setup().click(screen.getByRole("link", { name: "Start fresh" }));
  await screen.findByRole("heading", { name: "Earth, Moon and your sky" });
});

it("releases both scenes on navigation and retains numeric sky directions without WebGL", async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(sceneMocks.create).toHaveBeenCalledTimes(2));
  const scenes = sceneMocks.create.mock.results.map((result) => result.value);
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  for (const scene of scenes) expect(scene.dispose).toHaveBeenCalledOnce();
  sceneMocks.create.mockImplementation(() => {
    throw new Error("No WebGL");
  });
  act(() => navigateHash("/earth-moon"));
  await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
  expect(screen.getByText(/Moon: .*bearing from north/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "+1 hour" }));
  expect(screen.getByRole("heading", { name: "Earth, Moon and your sky" })).toBeTruthy();
});

it("uses the map directly without loading cities and synchronizes the single coordinate form", async () => {
  const loadCities = vi.spyOn(cityFunctions, "loadCities");
  render(<App />);
  const map = screen.getByRole("button", { name: "Pick a location on the world map" });
  expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
  expect(loadCities).not.toHaveBeenCalled();
  vi.spyOn(map, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1029, 450));
  const point = locationToPoint({ latitude: -30, longitude: 150 });
  fireEvent.click(map, { clientX: point[0] / 2, clientY: point[1] / 2 });
  expect((screen.getByRole("spinbutton", { name: "Latitude" }) as HTMLInputElement).value).toBe(
    "-30",
  );
  expect((screen.getByRole("spinbutton", { name: "Longitude" }) as HTMLInputElement).value).toBe(
    "150",
  );
  fireEvent.keyDown(map, { key: "ArrowRight", shiftKey: true });
  await waitFor(() => expect(persisted().location).toEqual({ latitude: -30, longitude: 150.1 }));
  expect(new URLSearchParams(splitHash(window.location.hash).search).get("note")).toBe("keep");
  await waitFor(() => expect(sceneMocks.create).toHaveBeenCalledTimes(2));
  for (const scene of sceneMocks.create.mock.results.map((result) => result.value)) {
    const snapshot = scene.update.mock.lastCall[0];
    expect(snapshot.frame).toEqual(observerFrame({ latitude: -30, longitude: 150.1 }));
  }
});

it("routes the separate camera controls to their own 3D view", async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(sceneMocks.create).toHaveBeenCalledTimes(2));
  const [space, sky] = sceneMocks.create.mock.results.map((result) => result.value);
  const spaceControls = within(
    screen.getByRole("region", { name: "Earth and Moon camera controls" }),
  );
  const skyControls = within(screen.getByRole("region", { name: "Horizon camera controls" }));
  await user.click(spaceControls.getByRole("button", { name: "Observer close-up" }));
  expect(space.reset).toHaveBeenLastCalledWith("observer");
  expect(sky.reset).not.toHaveBeenCalled();
  await user.click(skyControls.getByRole("button", { name: "Reset view" }));
  expect(sky.reset).toHaveBeenLastCalledWith("overview");
  await user.click(spaceControls.getByRole("button", { name: "Reset view" }));
  expect(space.reset).toHaveBeenLastCalledWith("overview");
});

it("scrubs the selected leap year and clamps keyboard edits to its edges", () => {
  window.history.replaceState(null, "", "/#/earth-moon?at=2024-02-29T12%3A00%3A00.000Z");
  render(<App />);
  const year = screen.getByRole("slider", { name: "Time within this UTC year" });
  const date = screen.getByLabelText("Date and time (UTC)") as HTMLInputElement;
  fireEvent.keyDown(year, { key: "ArrowRight" });
  expect(date.value).toBe("2024-03-01T12:00");
  fireEvent.keyDown(year, { key: "End" });
  expect(date.value).toBe("2024-12-31T23:59:59");
  fireEvent.keyDown(year, { key: "ArrowRight" });
  expect(date.value).toBe("2024-12-31T23:59:59");
  fireEvent.keyDown(year, { key: "Home" });
  expect(date.value).toBe("2024-01-01T00:00");
});

it("anchors pointer scrubbing to the selected day and clamps out-of-bounds dragging", () => {
  render(<App />);
  const slider = screen.getByRole("slider", { name: "Time within this UTC day" });
  vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({ left: 10, width: 100 } as DOMRect);
  slider.setPointerCapture = vi.fn();
  slider.hasPointerCapture = vi.fn(() => true);
  slider.releasePointerCapture = vi.fn();
  const date = screen.getByLabelText("Date and time (UTC)") as HTMLInputElement;
  fireEvent.pointerDown(slider, { pointerId: 1, button: 0, clientX: 35 });
  expect(date.value).toBe("2026-10-09T06:00");
  fireEvent.pointerMove(slider, { pointerId: 1, clientX: 150 });
  expect(date.value).toBe("2026-10-09T23:59:59");
  fireEvent.pointerMove(slider, { pointerId: 2, clientX: 10 });
  expect(date.value).toBe("2026-10-09T23:59:59");
  fireEvent.pointerUp(slider, { pointerId: 1, clientX: -10 });
  expect(date.value).toBe("2026-10-09T00:00");
  expect(slider.releasePointerCapture).toHaveBeenCalledWith(1);
});

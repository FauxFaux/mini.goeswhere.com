// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../app.tsx";
import { navigateHash, splitHash } from "../../boot/hash-location.ts";
import * as cityFunctions from "../../components/location-picker/cities.ts";
import { locationToPoint } from "../../components/location-picker/projection.ts";
import { dot, observerFrame } from "./astronomy.ts";
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

it("resets pending edits, playback and cameras to a clean default URL", async () => {
  const frames = playbackFrames();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-15T09:00:00Z"));
  render(<App />);
  await waitFor(() => expect(sceneMocks.create).toHaveBeenCalledTimes(2));
  const originalScenes = sceneMocks.create.mock.results.map((result) => result.value);
  fireEvent.click(screen.getByRole("checkbox", { name: "True Earth–Moon distance scale" }));
  fireEvent.click(screen.getByRole("button", { name: "Play at 3 hours per second" }));
  frames.advance(500);
  fireEvent.click(screen.getByRole("button", { name: "Reset Earth–Moon" }));
  await waitFor(() => expect(sceneMocks.create).toHaveBeenCalledTimes(4));
  expect(window.location.hash).toBe("#/earth-moon");
  expect((screen.getByLabelText("Date and time (UTC)") as HTMLInputElement).value).toBe(
    "2026-10-15T09:00",
  );
  expect((screen.getByRole("spinbutton", { name: "Latitude" }) as HTMLInputElement).value).toBe(
    String(earthMoonCodec.defaultState.location.latitude),
  );
  expect(
    (screen.getByRole("checkbox", { name: "True Earth–Moon distance scale" }) as HTMLInputElement)
      .checked,
  ).toBe(false);
  expect(screen.getByRole("button", { name: "Play at 3 hours per second" })).toBeTruthy();
  for (const scene of originalScenes) expect(scene.dispose).toHaveBeenCalledOnce();
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(window.location.hash).toBe("#/earth-moon");
  // A clean URL still needs to reset transient camera and form state.
  fireEvent.input(screen.getByRole("spinbutton", { name: "Latitude" }), {
    target: { value: "-30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Reset Earth–Moon" }));
  await waitFor(() => expect(sceneMocks.create).toHaveBeenCalledTimes(6));
  expect((screen.getByRole("spinbutton", { name: "Latitude" }) as HTMLInputElement).value).toBe(
    String(earthMoonCodec.defaultState.location.latitude),
  );
});

it("returns to the tool directory from the floating Home link", async () => {
  render(<App />);
  await userEvent.setup().click(screen.getByRole("link", { name: "All tools" }));
  expect(window.location.hash).toBe("#/");
  expect(screen.getByRole("link", { name: "Earth and Moon" })).toBeTruthy();
});

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

it("updates both strip gradients when the observer moves, and daylight when the date changes", () => {
  render(<App />);
  const day = screen.getByRole("slider", { name: "Time within this UTC day" });
  const year = screen.getByRole("slider", { name: "Time within this UTC year" });
  const originalDay = day.style.background;
  const originalYear = year.style.background;
  fireEvent.input(screen.getByRole("spinbutton", { name: "Latitude", exact: true }), {
    target: { value: "-33.8688" },
  });
  fireEvent.input(screen.getByRole("spinbutton", { name: "Longitude", exact: true }), {
    target: { value: "151.2093" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update view" }));
  expect(day.style.background).not.toBe(originalDay);
  expect(year.style.background).not.toBe(originalYear);
  const movedDay = day.style.background;
  const movedYear = year.style.background;
  fireEvent.keyDown(day, { key: "ArrowRight" });
  expect(day.style.background).toBe(movedDay);
  fireEvent.keyDown(year, { key: "Home" });
  expect(day.style.background).not.toBe(movedDay);
  expect(year.style.background).toBe(movedYear);
});

it("scrubs the lunar cycle and keeps its gradient stable at both new-moon edges", () => {
  render(<App />);
  const month = screen.getByRole("slider", { name: "Time within this lunar month" });
  const original = month.style.background;
  const date = screen.getByLabelText("Date and time (UTC)") as HTMLInputElement;
  fireEvent.keyDown(month, { key: "Home" });
  const start = date.value;
  expect(month.style.background).toBe(original);
  expect(month.getAttribute("aria-valuetext")).toContain("0% illuminated");
  fireEvent.keyDown(month, { key: "ArrowRight" });
  expect(Date.parse(date.value + "Z") - Date.parse(start + "Z")).toBe(86400000);
  fireEvent.keyDown(month, { key: "End" });
  const end = date.value;
  expect(month.style.background).toBe(original);
  expect(month.getAttribute("aria-valuetext")).toContain("0% illuminated");
  fireEvent.keyDown(month, { key: "ArrowRight" });
  expect(date.value).toBe(end);
});

it("clamps lunar scrubbing to the supported date range", () => {
  window.history.replaceState(null, "", "/#/earth-moon?at=1900-01-01T00%3A00%3A00.000Z");
  render(<App />);
  fireEvent.keyDown(screen.getByRole("slider", { name: "Time within this lunar month" }), {
    key: "Home",
  });
  expect((screen.getByLabelText("Date and time (UTC)") as HTMLInputElement).value).toBe(
    "1900-01-01T00:00",
  );
});

function playbackFrames() {
  let callback: FrameRequestCallback | undefined;
  vi.spyOn(performance, "now").mockReturnValue(0);
  const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((next) => {
    callback = next;
    return 1;
  });
  const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
    callback = undefined;
  });
  return {
    request,
    cancel,
    advance: (milliseconds: number) =>
      act(() => {
        const next = callback;
        callback = undefined;
        next?.(milliseconds);
      }),
  };
}

it("plays smoothly at 3 hours per second, pauses, persists, and releases the animation on navigation", async () => {
  const frames = playbackFrames();
  render(<App />);
  const date = screen.getByLabelText("Date and time (UTC)") as HTMLInputElement;
  fireEvent.click(screen.getByRole("button", { name: "Play at 3 hours per second" }));
  frames.advance(500);
  expect(date.value).toBe("2026-10-09T13:30");
  frames.advance(1000);
  expect(date.value).toBe("2026-10-09T15:00");
  // A persistence flush during playback must not be mistaken for an incoming link.
  fireEvent.pointerUp(document);
  expect(persisted().instant).toBe(Date.parse("2026-10-09T15:00:00Z"));
  frames.advance(1500);
  expect(date.value).toBe("2026-10-09T16:30");
  fireEvent.click(screen.getByRole("button", { name: "Pause at 3 hours per second" }));
  const requests = frames.request.mock.calls.length;
  frames.advance(2000);
  expect(date.value).toBe("2026-10-09T16:30");
  expect(frames.request).toHaveBeenCalledTimes(requests);
  fireEvent.click(screen.getByRole("button", { name: "Play at 3 hours per second" }));
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  expect(frames.cancel).toHaveBeenCalled();
});

it("plays at 9 days per second with smooth frozen lighting and restores ordinary time on manual edits", async () => {
  const frames = playbackFrames();
  render(<App />);
  await waitFor(() => expect(sceneMocks.create).toHaveBeenCalledTimes(2));
  const scene = sceneMocks.create.mock.results[0]!.value;
  const initial = scene.update.mock.lastCall[0];
  fireEvent.click(
    screen.getByRole("button", { name: "Play at 9 days per second (local time frozen)" }),
  );
  frames.advance(1000 / 36);
  expect((screen.getByLabelText("Date and time (UTC)") as HTMLInputElement).value).toBe(
    "2026-10-09T18:00",
  );
  expect(dot(initial.sunDirection, scene.update.mock.lastCall[0].sunDirection)).toBeGreaterThan(
    0.995,
  );
  frames.advance(1000);
  expect((screen.getByLabelText("Date and time (UTC)") as HTMLInputElement).value).toBe(
    "2026-10-18T12:00",
  );
  expect(dot(initial.sunDirection, scene.update.mock.lastCall[0].sunDirection)).toBeGreaterThan(
    0.995,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Pause at 9 days per second (local time frozen)" }),
  );
  expect(dot(initial.sunDirection, scene.update.mock.lastCall[0].sunDirection)).toBeGreaterThan(
    0.995,
  );
  fireEvent.click(screen.getByRole("button", { name: "+1 hour" }));
  expect(screen.queryByText(/Local time is frozen in the 3D views/)).toBeNull();
});

it("stops playback for incoming links and at the supported date limit", async () => {
  const frames = playbackFrames();
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Play at 3 hours per second" }));
  frames.advance(500);
  act(() => navigateHash("/earth-moon?at=2099-12-31T23%3A00%3A00.000Z"));
  expect(
    screen.getByRole("button", { name: "Play at 3 hours per second" }).getAttribute("aria-pressed"),
  ).toBe("false");
  frames.advance(1000);
  const date = screen.getByLabelText("Date and time (UTC)") as HTMLInputElement;
  expect(date.value).toBe("2099-12-31T23:00");
  fireEvent.click(screen.getByRole("button", { name: "Play at 3 hours per second" }));
  frames.advance(1000);
  expect(date.value).toBe("2099-12-31T23:59:59");
  expect(
    (screen.getByRole("button", { name: "Play at 3 hours per second" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.pointerUp(document);
  expect(persisted().instant).toBe(Date.parse("2099-12-31T23:59:59.999Z"));
});

it.each([
  ["3 hours", "2026-10-09T16:30"],
  ["9 days", "2026-10-23T00:00"],
])(
  "keeps playback at %s per second through location and scale changes",
  async (speed, expectedDate) => {
    const frames = playbackFrames();
    render(<App />);
    await waitFor(() => expect(sceneMocks.create).toHaveBeenCalledTimes(2));
    const suffix = speed === "9 days" ? " (local time frozen)" : "";
    fireEvent.click(screen.getByRole("button", { name: `Play at ${speed} per second${suffix}` }));
    frames.advance(501);
    const latitude = screen.getByRole("spinbutton", {
      name: "Latitude",
      exact: true,
    }) as HTMLInputElement;
    fireEvent.input(latitude, { target: { value: "-30" } });
    frames.advance(750);
    expect(latitude.value).toBe("-30");
    fireEvent.click(screen.getByRole("button", { name: "Update view" }));
    fireEvent.pointerUp(document);
    expect(persisted().location.latitude).toBe(-30);
    frames.advance(1000);
    fireEvent.keyDown(screen.getByRole("button", { name: "Pick a location on the world map" }), {
      key: "ArrowRight",
      shiftKey: true,
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "True Earth–Moon distance scale" }));
    fireEvent.pointerUp(document);
    frames.advance(1500);
    expect((screen.getByLabelText("Date and time (UTC)") as HTMLInputElement).value).toBe(
      expectedDate,
    );
    expect(
      screen
        .getByRole("button", { name: `Pause at ${speed} per second${suffix}` })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    const scene = sceneMocks.create.mock.results[0]!.value;
    expect(scene.update.mock.lastCall[0].frame).toEqual(
      observerFrame({ latitude: -30, longitude: 0 }),
    );
    expect(Boolean(screen.queryByText(/Local time is frozen in the 3D views/))).toBe(
      speed === "9 days",
    );
  },
);

it("accepts a GPS location requested during playback without pausing", () => {
  const frames = playbackFrames();
  let success: PositionCallback | undefined;
  vi.spyOn(navigator.geolocation, "getCurrentPosition").mockImplementation((ok) => {
    success = ok;
  });
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Play at 3 hours per second" }));
  fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
  frames.advance(500);
  act(() => success!({ coords: { latitude: -33.9, longitude: 151.2 } } as GeolocationPosition));
  expect(
    (screen.getByRole("spinbutton", { name: "Latitude", exact: true }) as HTMLInputElement).value,
  ).toBe("-33.9");
  frames.advance(1000);
  expect(
    screen
      .getByRole("button", { name: "Pause at 3 hours per second" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});

it("adjusts the held observation clock with the UTC-day strip while fast playback keeps advancing", async () => {
  const frames = playbackFrames();
  render(<App />);
  await waitFor(() => expect(sceneMocks.create).toHaveBeenCalledTimes(2));
  const scene = sceneMocks.create.mock.results[0]!.value;
  const day = screen.getByRole("slider", { name: "Time within this UTC day" });
  const date = screen.getByLabelText("Date and time (UTC)") as HTMLInputElement;
  fireEvent.click(
    screen.getByRole("button", { name: "Play at 9 days per second (local time frozen)" }),
  );
  frames.advance(500 / 3);
  expect(date.value).toBe("2026-10-11T00:00");
  expect(day.getAttribute("aria-valuetext")).toMatch(/^12:00:00 UTC/);
  const noon = scene.update.mock.lastCall[0];
  fireEvent.keyDown(day, { key: "Home" });
  expect(day.getAttribute("aria-valuetext")).toMatch(/^00:00:00 UTC/);
  expect(date.value).toBe("2026-10-11T00:00");
  const midnight = scene.update.mock.lastCall[0];
  expect(dot(noon.sunDirection, midnight.sunDirection)).toBeLessThan(-0.9);
  expect(midnight.illumination).toEqual(noon.illumination);
  frames.advance(1000 / 3);
  expect(date.value).toBe("2026-10-12T12:00");
  expect(day.getAttribute("aria-valuetext")).toMatch(/^00:00:00 UTC/);
  expect(dot(midnight.sunDirection, scene.update.mock.lastCall[0].sunDirection)).toBeGreaterThan(
    0.999,
  );
  fireEvent.keyDown(day, { key: "ArrowRight" });
  fireEvent.keyDown(day, { key: "ArrowRight" });
  expect(day.getAttribute("aria-valuetext")).toMatch(/^00:02:00 UTC/);

  vi.spyOn(day, "getBoundingClientRect").mockReturnValue({ left: 0, width: 100 } as DOMRect);
  day.setPointerCapture = vi.fn();
  day.hasPointerCapture = vi.fn(() => true);
  day.releasePointerCapture = vi.fn();
  fireEvent.pointerDown(day, { pointerId: 1, button: 0, clientX: 25 });
  expect(day.getAttribute("aria-valuetext")).toMatch(/^06:00:00 UTC/);
  frames.advance(2000 / 3);
  expect(date.value).toBe("2026-10-15T12:00");
  expect(day.getAttribute("aria-valuetext")).toMatch(/^06:00:00 UTC/);
  fireEvent.pointerUp(day, { pointerId: 1, clientX: 75 });
  expect(day.getAttribute("aria-valuetext")).toMatch(/^18:00:00 UTC/);
  frames.advance(2500 / 3);
  expect(date.value).toBe("2026-10-17T00:00");
  expect(day.getAttribute("aria-valuetext")).toMatch(/^18:00:00 UTC/);
  expect(
    screen
      .getByRole("button", { name: "Pause at 9 days per second (local time frozen)" })
      .getAttribute("aria-pressed"),
  ).toBe("true");

  fireEvent.click(screen.getByRole("button", { name: "Play at 3 hours per second" }));
  expect(day.getAttribute("aria-valuetext")).toMatch(/^00:00:00 UTC/);
  fireEvent.keyDown(day, { key: "ArrowRight" });
  expect(date.value).toBe("2026-10-17T00:01");
  expect(
    screen.getByRole("button", { name: "Play at 3 hours per second" }).getAttribute("aria-pressed"),
  ).toBe("false");
});

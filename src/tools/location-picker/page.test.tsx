// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../app.tsx";
import { navigateHash, splitHash } from "../../boot/hash-location.ts";
import { locationToPoint } from "../../components/location-picker/projection.ts";
import { locationPickerCodec } from "./state.ts";

beforeEach(() => window.history.replaceState(null, "", "/#/location-picker?note=keep"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function savedLocation() {
  return locationPickerCodec.query!.decode(
    new URLSearchParams(splitHash(window.location.hash).search),
  ).location;
}

it("follows mouse movement with the primary button held and flushes on release", async () => {
  render(<App />);
  const map = await screen.findByRole("button", { name: "Pick a location on the world map" });
  vi.spyOn(map, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 40, 1029, 450));
  const url = window.location.href;
  const historyLength = window.history.length;
  const first = locationToPoint({ latitude: 10, longitude: 20 });
  const second = locationToPoint({ latitude: -30, longitude: 150 });
  const move = (point: [number, number], buttons: number) =>
    fireEvent.mouseMove(map, {
      clientX: 20 + point[0] / 2,
      clientY: 40 + point[1] / 2,
      buttons,
    });
  move(first, 0);
  move(first, 2);
  move(first, 4);
  const latitude = screen.getByRole("spinbutton", {
    name: "Latitude (−90 to 90)",
  }) as HTMLInputElement;
  expect(latitude.value).toBe("51.5074");
  expect(window.location.href).toBe(url);
  move(first, 1);
  expect(latitude.value).toBe("10");
  move(second, 1);
  expect(latitude.value).toBe("-30");
  expect(window.location.href).toBe(url);
  fireEvent.mouseMove(map, { clientX: 420, clientY: 90, buttons: 1 });
  expect(latitude.value).toBe("-30");
  fireEvent.pointerUp(document);
  expect(savedLocation()).toEqual({ latitude: -30, longitude: 150 });
  expect(window.history.length).toBe(historyLength);
  expect(window.location.hash).toContain("note=keep");
  const releasedUrl = window.location.href;
  move(first, 0);
  expect(window.location.href).toBe(releasedUrl);
  expect(savedLocation()).toEqual({ latitude: -30, longitude: 150 });
});

it("picks scaled map coordinates, ignores gaps, and keeps edits in one history entry", async () => {
  render(<App />);
  const map = await screen.findByRole("button", { name: "Pick a location on the world map" });
  vi.spyOn(map, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 40, 1029, 450));
  const historyLength = window.history.length;
  const point = locationToPoint({ latitude: 51.5074, longitude: -0.1278 });
  fireEvent.click(map, { clientX: 20 + point[0] / 2, clientY: 40 + point[1] / 2 });
  await waitFor(() => expect(window.location.hash).toContain("lat=51.5074"));
  await waitFor(() => expect(savedLocation()).toEqual({ latitude: 51.5074, longitude: -0.1278 }));
  expect(
    (screen.getByRole("spinbutton", { name: "Latitude (−90 to 90)" }) as HTMLInputElement).value,
  ).toBe("51.5074");
  expect(window.history.length).toBe(historyLength);
  expect(window.location.hash).toContain("note=keep");
  const url = window.location.href;
  fireEvent.click(map, { clientX: 420, clientY: 90 });
  expect(savedLocation()).toEqual({ latitude: 51.5074, longitude: -0.1278 });
  expect(window.location.href).toBe(url);
  fireEvent.keyDown(map, { key: "ArrowRight", shiftKey: true });
  await waitFor(() => expect(savedLocation()).toEqual({ latitude: 51.5074, longitude: -0.0278 }));
});

it("sets coordinates and preserves the selection when inputs are invalid or empty", async () => {
  render(<App />);
  const latitude = await screen.findByRole("spinbutton", { name: "Latitude (−90 to 90)" });
  const longitude = screen.getByRole("spinbutton", { name: "Longitude (−180 to 180)" });
  fireEvent.input(latitude, { target: { value: "-33.8688" } });
  fireEvent.input(longitude, { target: { value: "151.2093" } });
  fireEvent.submit(latitude.closest("form")!);
  await waitFor(() => expect(savedLocation()).toEqual({ latitude: -33.8688, longitude: 151.2093 }));
  const url = window.location.href;
  fireEvent.input(latitude, { target: { value: "91" } });
  fireEvent.submit(latitude.closest("form")!);
  expect(window.location.href).toBe(url);
  fireEvent.input(latitude, { target: { value: "" } });
  fireEvent.submit(latitude.closest("form")!);
  expect(window.location.href).toBe(url);
  expect(savedLocation()).toEqual({ latitude: -33.8688, longitude: 151.2093 });
  cleanup();
  render(<App />);
  expect(
    ((await screen.findByRole("spinbutton", { name: "Latitude (−90 to 90)" })) as HTMLInputElement)
      .value,
  ).toBe("-33.8688");
});

it("restores shared selections, external links, and Back navigation without rewriting reads", async () => {
  window.history.replaceState(null, "", "/#/location-picker?lat=10&lon=20");
  const original = window.location.href;
  render(<App />);
  const latitude = await screen.findByRole("spinbutton", { name: "Latitude (−90 to 90)" });
  expect((latitude as HTMLInputElement).value).toBe("10");
  expect(window.location.href).toBe(original);
  window.location.hash = "/location-picker?lat=-30&lon=150";
  await waitFor(() => expect((latitude as HTMLInputElement).value).toBe("-30"));
  fireEvent.keyDown(screen.getByRole("button", { name: "Pick a location on the world map" }), {
    key: "ArrowUp",
  });
  await waitFor(() => expect(savedLocation()?.latitude).toBe(-29));
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  const restored = await screen.findByRole("spinbutton", { name: "Latitude (−90 to 90)" });
  await waitFor(() => expect((restored as HTMLInputElement).value).toBe("-29"));
});

it("preserves corrupt links and offers recovery", async () => {
  window.history.replaceState(null, "", "/#/location-picker?lat=91&lon=0");
  const original = window.location.href;
  render(<App />);
  await screen.findByRole("heading", { name: "Corrupt URL state" });
  expect(window.location.href).toBe(original);
  fireEvent.click(screen.getByRole("link", { name: "Start fresh" }));
  await screen.findByRole("button", { name: "Pick a location on the world map" });
  expect(savedLocation()).toEqual({ latitude: 51.5074, longitude: -0.1278 });
});

it("cuts out New Zealand only when enabled and restores the setting from URL changes", async () => {
  window.history.replaceState(null, "", "/#/location-picker?no-nz=1&note=keep");
  const { container } = render(<App />);
  const map = await screen.findByRole("button", { name: "Pick a location on the world map" });
  vi.spyOn(map, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 40, 1029, 450));
  const nz = { latitude: -41.2866, longitude: 174.7756 };
  const point = locationToPoint(nz);
  expect(container.querySelector(".location-picker-cutout")).not.toBeNull();
  const original = window.location.href;
  fireEvent.click(map, { clientX: 20 + point[0] / 2, clientY: 40 + point[1] / 2 });
  fireEvent.mouseMove(map, { clientX: 20 + point[0] / 2, clientY: 40 + point[1] / 2, buttons: 1 });
  fireEvent.pointerUp(document);
  expect(window.location.href).toBe(original);
  const latitude = screen.getByRole("spinbutton", { name: "Latitude (−90 to 90)" });
  const longitude = screen.getByRole("spinbutton", { name: "Longitude (−180 to 180)" });
  fireEvent.input(latitude, { target: { value: String(nz.latitude) } });
  fireEvent.input(longitude, { target: { value: String(nz.longitude) } });
  fireEvent.submit(latitude.closest("form")!);
  fireEvent.pointerUp(document);
  expect(window.location.href).toBe(original);
  const sydney = { latitude: -33.8688, longitude: 151.2093 };
  const australianPoint = locationToPoint(sydney);
  fireEvent.click(map, {
    clientX: 20 + australianPoint[0] / 2,
    clientY: 40 + australianPoint[1] / 2,
  });
  fireEvent.pointerUp(document);
  expect(savedLocation()).toEqual(sydney);
  expect(window.location.hash).toContain("no-nz=1");
  act(() => navigateHash("/location-picker?no-nz=0"));
  await waitFor(() => expect(container.querySelector(".location-picker-cutout")).toBeNull());
  fireEvent.click(map, { clientX: 20 + point[0] / 2, clientY: 40 + point[1] / 2 });
  fireEvent.pointerUp(document);
  expect(savedLocation()).toEqual(nz);
});

it("blocks keyboard selections in the cutout without rewriting existing shared coordinates", async () => {
  window.history.replaceState(null, "", "/#/location-picker?no-nz=1&lat=-41&lon=174");
  const original = window.location.href;
  const { container } = render(<App />);
  const map = await screen.findByRole("button", { name: "Pick a location on the world map" });
  expect(container.querySelector(".location-picker-marker")?.hasAttribute("hidden")).toBe(true);
  fireEvent.keyDown(map, { key: "ArrowRight" });
  fireEvent.pointerUp(document);
  expect(window.location.href).toBe(original);
});

it("uses the shared GPS control without triggering map selection and rejects invalid positions", async () => {
  let success: PositionCallback | undefined;
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((ok: PositionCallback) => {
        success = ok;
      }),
    },
  });
  render(<App />);
  const map = await screen.findByRole("button", { name: "Pick a location on the world map" });
  vi.spyOn(map, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1029, 450));
  const latitude = screen.getByRole("spinbutton", {
    name: "Latitude (−90 to 90)",
  }) as HTMLInputElement;
  fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
  expect(latitude.value).toBe("51.5074");
  expect((screen.getByRole("button", { name: "Locating…" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  act(() => success!({ coords: { latitude: -33.9, longitude: 151.2 } } as GeolocationPosition));
  expect(latitude.value).toBe("-33.9");
  fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
  act(() => success!({ coords: { latitude: 91, longitude: 0 } } as GeolocationPosition));
  expect(screen.getByRole("alert").textContent).toContain("Latitude must be between");
  expect(latitude.value).toBe("-33.9");
});

// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../app.tsx";
import { navigateHash, splitHash } from "../../boot/hash-location.ts";
import { locationToPoint } from "./projection.ts";
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
  expect(screen.getByRole("status").textContent).toBe("Selected: 51.507400° N, 0.127800° W");
  expect(window.location.href).toBe(url);
  move(first, 1);
  expect(screen.getByRole("status").textContent).toContain("10.000000° N");
  move(second, 1);
  expect(screen.getByRole("status").textContent).toContain("30.000000° S");
  expect(window.location.href).toBe(url);
  fireEvent.mouseMove(map, { clientX: 420, clientY: 90, buttons: 1 });
  expect(screen.getByRole("status").textContent).toContain("map gap");
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
  expect(screen.getByRole("status").textContent).toContain("51.507400° N");
  expect(window.history.length).toBe(historyLength);
  expect(window.location.hash).toContain("note=keep");
  const url = window.location.href;
  fireEvent.click(map, { clientX: 420, clientY: 90 });
  expect(screen.getByRole("status").textContent).toContain("map gap");
  expect(window.location.href).toBe(url);
  fireEvent.keyDown(map, { key: "ArrowRight", shiftKey: true });
  await waitFor(() => expect(savedLocation()).toEqual({ latitude: 51.5074, longitude: -0.0278 }));
});

it("sets coordinates, rejects invalid input, and clears the selection", async () => {
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
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  await waitFor(() => expect(savedLocation()).toBeNull());
  expect(window.location.hash).toBe("#/location-picker?note=keep&lat=&lon=");
  expect((latitude as HTMLInputElement).value).toBe("");
  cleanup();
  render(<App />);
  expect(
    ((await screen.findByRole("spinbutton", { name: "Latitude (−90 to 90)" })) as HTMLInputElement)
      .value,
  ).toBe("");
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

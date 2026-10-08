// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../app.tsx";
import { splitHash } from "../../boot/hash-location.ts";
import * as cityFunctions from "../../components/location-picker/cities.ts";
import { CityBrowser } from "../../components/location-picker/city-browser.tsx";
import { locationToPoint } from "../../components/location-picker/projection.ts";
import { locationPickerCodec } from "./state.ts";

const cities = cityFunctions.decodeCities([
  ["London", "GB", "London, City of", 51.507, -0.128],
  ["Sydney", "AU", "New South Wales", -33.868, 151.21],
  ["Tokyo", "JP", "Tōkyō", 35.685, 139.751],
]);

beforeEach(() => window.history.replaceState(null, "", "/#/location-picker?note=keep"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("loads only when the picker mounts and ranks the table from the pin without responding to hover", async () => {
  const user = userEvent.setup();
  let resolve!: (value: cityFunctions.City[]) => void;
  const load = vi.spyOn(cityFunctions, "loadCities").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  window.history.replaceState(null, "", "/#/");
  render(<App />);
  expect(load).not.toHaveBeenCalled();
  await user.click(screen.getByRole("link", { name: "Location picker" }));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  expect(screen.getByText("Loading cities…")).toBeTruthy();
  const map = screen.getByRole("button", { name: "Pick a location on the world map" });
  vi.spyOn(map, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 2058, 900));
  const point = locationToPoint({ latitude: 51.5074, longitude: -0.1278 });
  const url = window.location.href;
  fireEvent.mouseMove(map, { clientX: point[0], clientY: point[1], buttons: 0 });
  expect(screen.queryByRole("tooltip")).toBeNull();
  await act(async () => resolve(cities));
  const table = screen.getByRole("table", { name: "Cities" });
  const names = () =>
    within(table)
      .getAllByRole("button")
      .map((button) => button.textContent);
  expect(names()).toEqual(["London", "Tokyo", "Sydney"]);
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(window.location.href).toBe(url);
  const sydney = locationToPoint({ latitude: -33.868, longitude: 151.21 });
  fireEvent.mouseMove(map, { clientX: sydney[0], clientY: sydney[1], buttons: 0 });
  expect(names()).toEqual(["London", "Tokyo", "Sydney"]);
  expect(window.location.href).toBe(url);
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.mouseMove(map, { clientX: sydney[0], clientY: sydney[1], buttons: 1 });
  expect(names()).toEqual(["Sydney", "Tokyo", "London"]);
  expect(within(table).getAllByRole("row")[1].textContent).toContain("0 km");
});

it("searches the table and selects a city's coordinates by row or keyboard", async () => {
  const user = userEvent.setup();
  vi.spyOn(cityFunctions, "loadCities").mockResolvedValue(cities);
  render(<App />);
  const search = await screen.findByRole("searchbox", {
    name: "Search cities, countries, or regions",
  });
  const url = window.location.href;
  fireEvent.input(search, { target: { value: "new south wales" } });
  const table = screen.getByRole("table", { name: "Cities" });
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(window.location.href).toBe(url);
  await user.click(within(table).getByRole("cell", { name: "Australia" }));
  await waitFor(() =>
    expect(
      locationPickerCodec.query!.decode(new URLSearchParams(splitHash(window.location.hash).search))
        .location,
    ).toEqual({ latitude: -33.868, longitude: 151.21 }),
  );
  expect(window.location.hash).toContain("note=keep");
  expect(
    (screen.getByRole("spinbutton", { name: "Latitude (−90 to 90)" }) as HTMLInputElement).value,
  ).toBe("-33.868");
  fireEvent.input(search, { target: { value: "Tokyo Japan" } });
  const button = screen.getByRole("button", { name: "Select Tokyo, Japan, Tōkyō" });
  button.focus();
  await user.keyboard("{Enter}");
  await waitFor(() => expect(window.location.hash).toContain("lat=35.685&lon=139.751"));
});

it("paginates results, resets the page on search, and handles no matches", async () => {
  const user = userEvent.setup();
  const manyCities = cityFunctions.decodeCities(
    Array.from({ length: 65 }, (_, i) => [
      `City${String(i).padStart(2, "0")}`,
      "GB",
      "Region",
      0,
      i,
    ]),
  );
  render(
    <CityBrowser
      catalogue={{ kind: "ready", cities: manyCities }}
      retry={() => {}}
      onSelect={() => {}}
      location={{ latitude: 0, longitude: 0 }}
    />,
  );
  const table = screen.getByRole("table", { name: "Cities" });
  expect(within(table).getAllByRole("row")).toHaveLength(51);
  await user.click(screen.getByRole("button", { name: "Next cities" }));
  expect(within(table).getAllByRole("row")).toHaveLength(16);
  expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  fireEvent.input(screen.getByRole("searchbox"), { target: { value: "City00" } });
  expect(screen.getByText("Page 1 of 1")).toBeTruthy();
  expect(
    within(table).getByRole("button", { name: "Select City00, United Kingdom, Region" }),
  ).toBeTruthy();
  fireEvent.input(screen.getByRole("searchbox"), { target: { value: "missing" } });
  expect(screen.getByText("No cities match your search.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Next cities" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});

it("recovers from a failed city load while the map remains usable", async () => {
  const user = userEvent.setup();
  vi.spyOn(cityFunctions, "loadCities")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(cities);
  render(<App />);
  await screen.findByRole("alert");
  fireEvent.keyDown(screen.getByRole("button", { name: "Pick a location on the world map" }), {
    key: "ArrowUp",
  });
  expect(
    (screen.getByRole("spinbutton", { name: "Latitude (−90 to 90)" }) as HTMLInputElement).value,
  ).toBe("52.5074");
  await user.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("table", { name: "Cities" });
});

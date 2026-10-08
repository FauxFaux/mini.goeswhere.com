// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it } from "vitest";
import { App } from "../../app.tsx";
import { navigateHash, splitHash } from "../../boot/hash-location.ts";
import { packState, unpackState } from "../../boot/url-state.ts";
import { POUNDS_TO_KG } from "./standards.ts";

beforeEach(() => window.history.replaceState(null, "", "/#/strength-standards?note=keep"));
afterEach(cleanup);

it("keeps the highest lift near the graph top continuously across former scale boundaries", async () => {
  render(<App />);
  const slider = await screen.findByRole("slider", { name: "Bodyweight slider (kg)" });
  let previousTop: number | undefined;
  for (const weight of [52, 60, 64, 65, 66, 70, 80, 100, 146]) {
    fireEvent.input(slider, { target: { value: String(weight) } });
    const graph = screen.getByRole("img", { name: "Strength standards graph" });
    const highestPoint = Math.min(
      ...Array.from(graph.querySelectorAll("circle"), (point) => Number(point.getAttribute("cy"))),
    );
    expect(highestPoint).toBeGreaterThan(36);
    expect(highestPoint).toBeLessThan(55);
    if (previousTop !== undefined) expect(highestPoint).toBeCloseTo(previousTop, 8);
    previousTop = highestPoint;
  }
});

it("plots all five interpolated lifts only when bodyweight is selected and updates for sex and units", async () => {
  const user = userEvent.setup();
  render(<App />);
  const slider = await screen.findByRole("slider", { name: "Bodyweight slider (kg)" });
  expect(screen.queryByRole("img", { name: "Strength standards graph" })).toBeNull();
  await user.click(screen.getByRole("radio", { name: "Pounds (lb)" }));
  fireEvent.input(slider, { target: { value: "173" } });
  const graph = screen.getByRole("img", { name: "Strength standards graph" });
  expect(graph.querySelectorAll("polyline")).toHaveLength(5);
  expect(graph.querySelectorAll("circle")).toHaveLength(25);
  expect(within(graph).getByText("Press, Cat. III: 133.5 lb")).toBeTruthy();
  expect(within(graph).getByText("Lift weight (lb)")).toBeTruthy();
  const points = graph.querySelector("polyline")!.getAttribute("points");
  await user.click(screen.getByRole("radio", { name: "Women" }));
  expect(within(graph).getByText("Press, Cat. III: 80 lb")).toBeTruthy();
  expect(graph.querySelector("polyline")!.getAttribute("points")).not.toBe(points);
  await user.click(screen.getByRole("radio", { name: "Kilograms (kg)" }));
  expect(within(graph).getByText("Lift weight (kg)")).toBeTruthy();
  expect(within(graph).getByText("Press, Cat. III: 36.1 kg")).toBeTruthy();
  await user.clear(screen.getByRole("spinbutton", { name: "Bodyweight (kg)" }));
  expect(screen.queryByRole("img", { name: "Strength standards graph" })).toBeNull();
});

it("defaults to men/kg and persists both toggles without adding history entries", async () => {
  const user = userEvent.setup();
  const historyLength = window.history.length;
  render(<App />);
  const men = await screen.findByRole("radio", { name: "Men" });
  expect((men as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("radio", { name: "Kilograms (kg)" }) as HTMLInputElement).checked).toBe(
    true,
  );
  const press = screen.getByRole("table", { name: "Press — Adult men (kg)" });
  expect(within(press).getByRole("row", { name: "74.8 34.0 46.3 58.5 69.4 84.4" })).toBeTruthy();
  expect(within(press).getByRole("rowheader", { name: "145.1+" })).toBeTruthy();
  expect(window.location.hash).toBe("#/strength-standards?note=keep");
  await user.click(screen.getByRole("radio", { name: "Women" }));
  await user.click(screen.getByRole("radio", { name: "Pounds (lb)" }));
  const womenPress = screen.getByRole("table", { name: "Press — Adult women (lb)" });
  expect(within(womenPress).getByRole("row", { name: "165 48 65 77 102 134" })).toBeTruthy();
  expect(within(womenPress).getByRole("rowheader", { name: "199+" })).toBeTruthy();
  const params = new URLSearchParams(splitHash(window.location.hash).search);
  expect(unpackState(params.get("s")!)).toEqual({ v: 1, sex: "women", unit: "lb" });
  expect(params.get("note")).toBe("keep");
  expect(window.history.length).toBe(historyLength);
});

it("restores shared choices, external hash changes, and history navigation", async () => {
  const shared = { v: 1, sex: "women", unit: "lb" };
  window.history.replaceState(null, "", `/#/strength-standards?s=${packState(shared)}`);
  const original = window.location.href;
  render(<App />);
  await screen.findByRole("table", { name: "Press — Adult women (lb)" });
  expect(window.location.href).toBe(original);
  window.location.hash = `/strength-standards?s=${packState({ ...shared, sex: "men" })}`;
  await screen.findByRole("table", { name: "Press — Adult men (lb)" });
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  await screen.findByRole("table", { name: "Press — Adult men (lb)" });
  window.history.forward();
  await screen.findByRole("textbox", { name: "Your name" });
});

it("preserves corrupt links and offers recovery", async () => {
  const user = userEvent.setup();
  window.history.replaceState(
    null,
    "",
    `/#/strength-standards?s=${packState({ v: 1, unit: "bad" })}`,
  );
  const original = window.location.href;
  render(<App />);
  await screen.findByRole("heading", { name: "Corrupt URL state" });
  expect(window.location.href).toBe(original);
  await user.click(screen.getByRole("link", { name: "Start fresh" }));
  await waitFor(() => expect(screen.getAllByRole("table")).toHaveLength(5));
  expect(window.location.hash).toBe("#/strength-standards");
});

it("shows interpolated categories and clears back to full tables", async () => {
  const user = userEvent.setup();
  render(<App />);
  const weight = await screen.findByRole("spinbutton", { name: "Bodyweight (kg)" });
  fireEvent.input(weight, { target: { value: String(173 * POUNDS_TO_KG) } });
  const kgPress = screen.getByRole("table", { name: "Press — Adult men (kg)" });
  expect(within(kgPress).getAllByRole("row")).toHaveLength(2);
  expect(within(kgPress).getByRole("row", { name: "35.4 48.1 60.6 71.9 91.6" })).toBeTruthy();
  expect(within(kgPress).queryByRole("columnheader", { name: "Bodyweight" })).toBeNull();
  await user.click(screen.getByRole("radio", { name: "Pounds (lb)" }));
  expect((weight as HTMLInputElement).value).toBe("173");
  const press = screen.getByRole("table", { name: "Press — Adult men (lb)" });
  expect(within(press).getByRole("row", { name: "78 106 133.5 158.5 202" })).toBeTruthy();
  expect(
    unpackState(new URLSearchParams(splitHash(window.location.hash).search).get("s")!),
  ).toEqual({
    v: 1,
    sex: "men",
    unit: "lb",
    weight: 173,
  });
  await user.click(screen.getByRole("radio", { name: "Women" }));
  expect(
    within(screen.getByRole("table", { name: "Press — Adult women (lb)" })).getByRole("row", {
      name: "49.5 67.5 80 106 137",
    }),
  ).toBeTruthy();
  await user.clear(weight);
  expect(
    within(screen.getByRole("table", { name: "Press — Adult women (lb)" })).getAllByRole("row"),
  ).toHaveLength(11);
});

it("rounds bodyweight on unit changes and saves the rounded weight for calculations and restoration", async () => {
  const user = userEvent.setup();
  render(<App />);
  const input = await screen.findByRole("spinbutton", { name: "Bodyweight (kg)" });
  fireEvent.input(input, { target: { value: "80.5" } });
  await user.click(screen.getByRole("radio", { name: "Pounds (lb)" }));
  expect((input as HTMLInputElement).value).toBe("177");
  let params = new URLSearchParams(splitHash(window.location.hash).search);
  expect(unpackState(params.get("s")!)).toEqual({ v: 1, sex: "men", unit: "lb", weight: 177 });
  await user.click(screen.getByRole("radio", { name: "Kilograms (kg)" }));
  expect((input as HTMLInputElement).value).toBe("80");
  params = new URLSearchParams(splitHash(window.location.hash).search);
  expect(unpackState(params.get("s")!)).toEqual({
    v: 1,
    sex: "men",
    unit: "kg",
    weight: 80 / POUNDS_TO_KG,
  });
  cleanup();
  render(<App />);
  const restored = await screen.findByRole("spinbutton", { name: "Bodyweight (kg)" });
  expect((restored as HTMLInputElement).value).toBe("80");
  await user.clear(restored);
  await user.click(screen.getByRole("radio", { name: "Pounds (lb)" }));
  expect((restored as HTMLInputElement).value).toBe("");
  expect(
    within(screen.getByRole("table", { name: "Press — Adult men (lb)" })).getAllByRole("row"),
  ).toHaveLength(13);
});

it("restores bodyweight from shared links and history, and handles out-of-range inputs", async () => {
  window.history.replaceState(
    null,
    "",
    `/#/strength-standards?s=${packState({ v: 1, sex: "men", unit: "lb", weight: 173 })}`,
  );
  render(<App />);
  const input = await screen.findByRole("spinbutton", { name: "Bodyweight (lb)" });
  expect((input as HTMLInputElement).value).toBe("173");
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  const restored = await screen.findByRole("spinbutton", { name: "Bodyweight (lb)" });
  expect((restored as HTMLInputElement).value).toBe("173");
  fireEvent.input(restored, { target: { value: "100" } });
  expect(screen.getByRole("status").textContent).toContain("No standards are listed below 114 lb");
  expect(screen.queryAllByRole("table")).toHaveLength(0);
  fireEvent.input(restored, { target: { value: "400" } });
  expect(
    within(screen.getByRole("table", { name: "Press — Adult men (lb)" })).getByRole("row", {
      name: "100 136 171 203 284",
    }),
  ).toBeTruthy();
  fireEvent.focusOut(restored);
  expect((restored as HTMLInputElement).value).toBe("320");
});

it("uses the bounded slider to select and persist a bodyweight, adjusting bounds with sex and units", async () => {
  const user = userEvent.setup();
  render(<App />);
  const slider = await screen.findByRole("slider", { name: "Bodyweight slider (kg)" });
  expect(slider.getAttribute("min")).toBe("52");
  expect(slider.getAttribute("max")).toBe("146");
  fireEvent.input(slider, { target: { value: "80" } });
  const input = screen.getByRole("spinbutton", { name: "Bodyweight (kg)" });
  expect((input as HTMLInputElement).value).toBe("80");
  expect(
    within(screen.getByRole("table", { name: "Press — Adult men (kg)" })).getAllByRole("row"),
  ).toHaveLength(2);
  expect(
    unpackState(new URLSearchParams(splitHash(window.location.hash).search).get("s")!),
  ).toEqual({
    v: 1,
    sex: "men",
    unit: "kg",
    weight: 80 / POUNDS_TO_KG,
  });
  fireEvent.input(slider, { target: { value: "146" } });
  await user.click(screen.getByRole("radio", { name: "Women" }));
  expect(slider.getAttribute("min")).toBe("44");
  expect(slider.getAttribute("max")).toBe("91");
  expect((input as HTMLInputElement).value).toBe("91");
  await user.click(screen.getByRole("radio", { name: "Pounds (lb)" }));
  expect(slider.getAttribute("min")).toBe("97");
  expect(slider.getAttribute("max")).toBe("199");
  expect((input as HTMLInputElement).value).toBe("199");
  fireEvent.input(slider, { target: { value: "97" } });
  await user.click(screen.getByRole("radio", { name: "Men" }));
  expect((input as HTMLInputElement).value).toBe("114");
  expect((slider as HTMLInputElement).value).toBe("114");
});

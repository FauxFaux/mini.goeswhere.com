// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../app.tsx";
import { navigateHash, splitHash } from "../../boot/hash-location.ts";
import { packState } from "../../boot/url-state.ts";
import { strengthStandardsCodec } from "./state.ts";
import { POUNDS_TO_KG } from "./standards.ts";

beforeEach(() => window.history.replaceState(null, "", "/#/strength-standards?note=keep"));
afterEach(cleanup);

it("restores and edits readable query inputs with rounded values", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/#/strength-standards?s=m&w=74.5&c=0.082");
  const original = window.location.href;
  render(<App />);
  const input = await screen.findByRole("spinbutton", { name: "Bodyweight (kg)" });
  expect((input as HTMLInputElement).value).toBe("74.5");
  expect(screen.getByText("0.08", { selector: ".strength-standards-category-value" })).toBeTruthy();
  expect(window.location.href).toBe(original);
  fireEvent.input(input, { target: { value: "74.456" } });
  expect(window.location.hash).toBe("#/strength-standards?s=m&w=74.5&c=0.082");
  const graph = screen.getByRole("img", { name: "Strength standards graph" });
  const bounds = vi
    .spyOn(graph, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(0, 0, 640, 320));
  fireEvent.click(graph, { clientX: 71.57 });
  bounds.mockRestore();
  expect(window.location.hash).toBe("#/strength-standards?s=m&w=74.5&c=0.041");
  await user.click(screen.getByRole("radio", { name: "Women" }));
  expect(window.location.hash).toBe("#/strength-standards?s=f&w=74.5&c=0.041");
  await user.click(screen.getByRole("radio", { name: "Pounds (lb)" }));
  expect(window.location.hash).toBe("#/strength-standards?s=f&w=164&c=0.041&u=l");
});

it("persists clicked graph categories, restores shared links and history, and keeps hover temporary", async () => {
  const shared = { v: 1, sex: "men", unit: "lb", weight: 173 };
  window.history.replaceState(null, "", `/#/strength-standards?note=keep&s=${packState(shared)}`);
  render(<App />);
  const graph = await screen.findByRole("img", { name: "Strength standards graph" });
  const original = window.location.href;
  const historyLength = window.history.length;
  const bounds = vi
    .spyOn(graph, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(0, 0, 640, 320));
  fireEvent.pointerMove(graph, { clientX: 294 });
  expect(screen.getByText("1.5", { selector: ".strength-standards-category-value" })).toBeTruthy();
  expect(window.location.href).toBe(original);
  fireEvent.click(graph, { clientX: 294 });
  fireEvent.pointerLeave(graph);
  bounds.mockRestore();
  let params = new URLSearchParams(splitHash(window.location.hash).search);
  expect(strengthStandardsCodec.query!.decode(params)).toEqual({ ...shared, graphCategory: 1.5 });
  expect(params.get("note")).toBe("keep");
  expect(window.history.length).toBe(historyLength);
  cleanup();
  render(<App />);
  await screen.findByText("1.5", { selector: ".strength-standards-category-value" });
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  await screen.findByText("1.5", { selector: ".strength-standards-category-value" });
  window.location.hash = `/strength-standards?s=${packState({ ...shared, graphCategory: 0 })}`;
  await screen.findByText("0", { selector: ".strength-standards-category-value" });
  fireEvent.keyDown(screen.getByRole("img", { name: "Strength standards graph" }), { key: "End" });
  params = new URLSearchParams(splitHash(window.location.hash).search);
  expect(strengthStandardsCodec.query!.decode(params)).toEqual({ ...shared, graphCategory: 5 });
  fireEvent.keyDown(screen.getByRole("img", { name: "Strength standards graph" }), {
    key: "Escape",
  });
  params = new URLSearchParams(splitHash(window.location.hash).search);
  expect(strengthStandardsCodec.query!.decode(params)).toEqual(shared);
});

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
  expect(screen.getByRole("img", { name: "Strength standards graph" })).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: "Pounds (lb)" }));
  fireEvent.input(slider, { target: { value: "173" } });
  const graph = screen.getByRole("img", { name: "Strength standards graph" });
  expect(graph.querySelectorAll("polyline")).toHaveLength(5);
  expect(graph.querySelectorAll("circle")).toHaveLength(35);
  expect(graph.querySelectorAll('line[stroke-dasharray="4 4"][stroke-width="2"]')).toHaveLength(5);
  for (const line of graph.querySelectorAll("polyline")) {
    const points = line
      .getAttribute("points")!
      .split(" ")
      .map((point) => point.split(",").map(Number));
    const interpolated = line.previousElementSibling!;
    expect(interpolated.getAttribute("stroke-dasharray")).toBe("4 4");
    expect(interpolated.getAttribute("stroke")).toBe(line.getAttribute("stroke"));
    expect(Number(interpolated.getAttribute("x1"))).toBe(64);
    expect(Number(interpolated.getAttribute("y1"))).toBe(264);
    expect([
      Number(interpolated.getAttribute("x2")),
      Number(interpolated.getAttribute("y2")),
    ]).toEqual(points[0]);
    expect(line.hasAttribute("stroke-dasharray")).toBe(false);
    const firstGap = points[0]![0]! - 64;
    const categoryGap = points[1]![0]! - points[0]![0]!;
    expect(firstGap).toBeCloseTo(2 * categoryGap);
    expect(points[4]![0]).toBe(616);
  }
  expect(within(graph).getByText("Press, Cat. 0: 0 lb")).toBeTruthy();
  expect(within(graph).getByText("Press, Cat. III: 133.5 lb")).toBeTruthy();
  const points = graph.querySelector("polyline")!.getAttribute("points");
  await user.click(screen.getByRole("radio", { name: "Women" }));
  expect(within(graph).getByText("Press, Cat. III: 80 lb")).toBeTruthy();
  expect(graph.querySelector("polyline")!.getAttribute("points")).not.toBe(points);
  await user.click(screen.getByRole("radio", { name: "Kilograms (kg)" }));
  expect(within(graph).getByText("Press, Cat. III: 36.1 kg")).toBeTruthy();
  await user.clear(screen.getByRole("spinbutton", { name: "Bodyweight (kg)" }));
  expect(screen.queryByRole("img", { name: "Strength standards graph" })).toBeNull();
});

it("defaults to 75 kg men and category 1, showing the full raw tables below the graph", async () => {
  const user = userEvent.setup();
  const historyLength = window.history.length;
  render(<App />);
  const men = await screen.findByRole("radio", { name: "Men" });
  expect((men as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("radio", { name: "Kilograms (kg)" }) as HTMLInputElement).checked).toBe(
    true,
  );
  const press = screen.getByRole("table", { name: "Press — Adult men (kg)" });
  expect(
    (screen.getByRole("spinbutton", { name: "Bodyweight (kg)" }) as HTMLInputElement).value,
  ).toBe("75");
  expect(screen.getByText("1", { selector: ".strength-standards-category-value" })).toBeTruthy();
  const graph = screen.getByRole("img", { name: "Strength standards graph" });
  const rawTables = screen.getByRole("region", { name: "Raw tables" });
  expect(graph.compareDocumentPosition(rawTables) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  for (const table of within(rawTables).getAllByRole("table")) {
    expect(within(table).getAllByRole("row")).toHaveLength(13);
    expect(within(table).getByRole("columnheader", { name: "Bodyweight" })).toBeTruthy();
  }
  expect(within(press).getByRole("row", { name: "74.8 34.0 46.3 58.5 69.4 84.4" })).toBeTruthy();
  expect(within(press).getByRole("rowheader", { name: "145.1+" })).toBeTruthy();
  expect(window.location.hash).toBe("#/strength-standards?note=keep");
  await user.click(screen.getByRole("radio", { name: "Women" }));
  await user.click(screen.getByRole("radio", { name: "Pounds (lb)" }));
  const womenPress = screen.getByRole("table", { name: "Press — Adult women (lb)" });
  expect(within(womenPress).getByRole("row", { name: "165 48 65 77 102 134" })).toBeTruthy();
  expect(within(womenPress).getByRole("rowheader", { name: "199+" })).toBeTruthy();
  const params = new URLSearchParams(splitHash(window.location.hash).search);
  expect(strengthStandardsCodec.query!.decode(params)).toEqual({
    v: 1,
    sex: "women",
    unit: "lb",
    weight: 165,
    graphCategory: 1,
  });
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

it.each([`s=${packState({ v: 1, unit: "bad" })}`, "s=m&w=75&c=Infinity"])(
  "preserves corrupt links and offers recovery: %s",
  async (query) => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", `/#/strength-standards?${query}`);
    const original = window.location.href;
    render(<App />);
    await screen.findByRole("heading", { name: "Corrupt URL state" });
    expect(window.location.href).toBe(original);
    await user.click(screen.getByRole("link", { name: "Start fresh" }));
    await waitFor(() => expect(screen.getAllByRole("table")).toHaveLength(5));
    expect(window.location.hash).toBe("#/strength-standards");
  },
);

it("updates interpolated graph values while keeping every raw bodyweight row", async () => {
  const user = userEvent.setup();
  render(<App />);
  const weight = await screen.findByRole("spinbutton", { name: "Bodyweight (kg)" });
  const kgPress = screen.getByRole("table", { name: "Press — Adult men (kg)" });
  const initialRows = kgPress.textContent;
  fireEvent.input(weight, { target: { value: String(173 * POUNDS_TO_KG) } });
  const graph = screen.getByRole("img", { name: "Strength standards graph" });
  expect(within(graph).getByText("Press, Cat. III: 60.6 kg")).toBeTruthy();
  expect(kgPress.textContent).toBe(initialRows);
  await user.click(screen.getByRole("radio", { name: "Pounds (lb)" }));
  expect((weight as HTMLInputElement).value).toBe("173");
  expect(within(graph).getByText("Press, Cat. III: 133.5 lb")).toBeTruthy();
  const press = screen.getByRole("table", { name: "Press — Adult men (lb)" });
  expect(within(press).getAllByRole("row")).toHaveLength(13);
  expect(within(press).getByRole("columnheader", { name: "Bodyweight" })).toBeTruthy();
  expect(
    strengthStandardsCodec.query!.decode(
      new URLSearchParams(splitHash(window.location.hash).search),
    ),
  ).toEqual({
    v: 1,
    sex: "men",
    unit: "lb",
    weight: 173,
    graphCategory: 1,
  });
  await user.click(screen.getByRole("radio", { name: "Women" }));
  expect(within(graph).getByText("Press, Cat. III: 80 lb")).toBeTruthy();
  const womenPress = screen.getByRole("table", { name: "Press — Adult women (lb)" });
  const womenRows = womenPress.textContent;
  await user.clear(weight);
  expect(screen.queryByRole("img", { name: "Strength standards graph" })).toBeNull();
  expect(womenPress.textContent).toBe(womenRows);
  expect(within(womenPress).getAllByRole("row")).toHaveLength(11);
});

it("rounds bodyweight on unit changes and saves the rounded weight for calculations and restoration", async () => {
  const user = userEvent.setup();
  render(<App />);
  const input = await screen.findByRole("spinbutton", { name: "Bodyweight (kg)" });
  fireEvent.input(input, { target: { value: "80.5" } });
  await user.click(screen.getByRole("radio", { name: "Pounds (lb)" }));
  expect((input as HTMLInputElement).value).toBe("177");
  let params = new URLSearchParams(splitHash(window.location.hash).search);
  expect(strengthStandardsCodec.query!.decode(params)).toEqual({
    v: 1,
    sex: "men",
    unit: "lb",
    weight: 177,
    graphCategory: 1,
  });
  await user.click(screen.getByRole("radio", { name: "Kilograms (kg)" }));
  expect((input as HTMLInputElement).value).toBe("80");
  params = new URLSearchParams(splitHash(window.location.hash).search);
  expect(strengthStandardsCodec.query!.decode(params)).toEqual({
    v: 1,
    sex: "men",
    unit: "kg",
    weight: 80 / POUNDS_TO_KG,
    graphCategory: 1,
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
  expect(screen.getAllByRole("table")).toHaveLength(5);
  expect(screen.queryByRole("img", { name: "Strength standards graph" })).toBeNull();
  fireEvent.input(restored, { target: { value: "400" } });
  expect(
    within(screen.getByRole("table", { name: "Press — Adult men (lb)" })).getByRole("row", {
      name: "320+ 100 136 171 203 284",
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
  ).toHaveLength(13);
  expect(
    strengthStandardsCodec.query!.decode(
      new URLSearchParams(splitHash(window.location.hash).search),
    ),
  ).toEqual({
    v: 1,
    sex: "men",
    unit: "kg",
    weight: 80 / POUNDS_TO_KG,
    graphCategory: 1,
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

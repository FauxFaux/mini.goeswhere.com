// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/preact";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "preact/hooks";
import { StandardsGraph } from "./graph.tsx";
import type { StrengthStandardsState } from "./state.ts";

function TestGraph({ state }: { state: StrengthStandardsState }) {
  const [graphCategory, setGraphCategory] = useState<number>();
  const current = { ...state, graphCategory };
  return (
    <StandardsGraph
      uss={[
        current,
        (update) => {
          const next = typeof update === "function" ? update(current) : update;
          setGraphCategory(next.graphCategory);
        },
      ]}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("reads interpolated values under a pointer on a scaled graph and retains the clicked position", () => {
  const { rerender } = render(<TestGraph state={{ v: 1, sex: "men", unit: "lb", weight: 173 }} />);
  const graph = screen.getByRole("img", { name: "Strength standards graph" });
  vi.spyOn(graph, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 0, 320, 160));
  const legend = screen.getByRole("list", { name: "Graph legend" });
  const moveTo = (svgX: number) => fireEvent.pointerMove(graph, { clientX: 100 + svgX / 2 });
  moveTo(294);
  expect(screen.getByText("1.5", { selector: ".strength-standards-category-value" })).toBeTruthy();
  expect(within(legend).getByText("92 lb")).toBeTruthy();
  const cursor = graph.querySelector(".strength-standards-cursor line")!;
  expect(Number(cursor.getAttribute("x1"))).toBeCloseTo(294);
  expect(cursor.getAttribute("x2")).toBe(cursor.getAttribute("x1"));
  fireEvent.click(graph, { clientX: 247 });
  moveTo(156);
  expect(screen.getByText("0.5", { selector: ".strength-standards-category-value" })).toBeTruthy();
  expect(within(legend).getByText("39 lb")).toBeTruthy();
  fireEvent.pointerLeave(graph);
  expect(screen.getByText("1.5", { selector: ".strength-standards-category-value" })).toBeTruthy();
  rerender(<TestGraph state={{ v: 1, sex: "men", unit: "kg", weight: 173 }} />);
  expect(within(legend).getByText("41.7 kg")).toBeTruthy();
  rerender(<TestGraph state={{ v: 1, sex: "women", unit: "lb", weight: 173 }} />);
  expect(within(legend).getByText("58.5 lb")).toBeTruthy();
  fireEvent.keyDown(graph, { key: "Escape" });
  expect(graph.querySelector(".strength-standards-cursor")).toBeNull();
  moveTo(0);
  expect(screen.getByText("0", { selector: ".strength-standards-category-value" })).toBeTruthy();
  expect(within(legend).getAllByText("0 lb")).toHaveLength(5);
  moveTo(640);
  expect(screen.getByText("5", { selector: ".strength-standards-category-value" })).toBeTruthy();
  fireEvent.pointerLeave(graph);
  expect(graph.querySelector(".strength-standards-cursor")).toBeNull();
});

it("supports keyboard selection and clearing without requiring a pointer", () => {
  render(<TestGraph state={{ v: 1, sex: "men", unit: "lb", weight: 173 }} />);
  const graph = screen.getByRole("img", { name: "Strength standards graph" });
  fireEvent.keyDown(graph, { key: "End" });
  expect(screen.getByText("5", { selector: ".strength-standards-category-value" })).toBeTruthy();
  expect(
    within(screen.getByRole("list", { name: "Graph legend" })).getByText("202 lb"),
  ).toBeTruthy();
  fireEvent.keyDown(graph, { key: "ArrowLeft" });
  expect(screen.getByText("4.9", { selector: ".strength-standards-category-value" })).toBeTruthy();
  fireEvent.keyDown(graph, { key: "Home" });
  expect(screen.getByText("0", { selector: ".strength-standards-category-value" })).toBeTruthy();
  fireEvent.keyDown(graph, { key: "ArrowRight" });
  expect(screen.getByText("0.05", { selector: ".strength-standards-category-value" })).toBeTruthy();
  fireEvent.keyDown(graph, { key: "Escape" });
  expect(graph.querySelector(".strength-standards-cursor")).toBeNull();
});

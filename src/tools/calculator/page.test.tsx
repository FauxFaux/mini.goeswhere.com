// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import type { CalculationResult } from "../../assets/qalculate.mjs";
import { useMiniLocation, useMiniSearch } from "../../boot/hash-location.ts";
import { packState, unpackState } from "../../boot/url-state.ts";
import { Calculator } from "./page.tsx";
import { MAX_TILES } from "./state.ts";

const mock = vi.hoisted(() => ({ calculate: vi.fn(), dispose: vi.fn() }));
vi.mock("./engine.ts", () => ({
  CalculatorEngine: class {
    calculate = mock.calculate;
    dispose = mock.dispose;
  },
}));

beforeEach(() => {
  mock.calculate.mockReset();
  mock.dispose.mockReset();
  window.history.replaceState(
    null,
    "",
    `/#/calculator?s=${packState({ v: 1, tiles: [{ id: "one", expression: "first" }] })}`,
  );
});
afterEach(cleanup);
function mount() {
  return render(
    <Router hook={useMiniLocation} searchHook={useMiniSearch}>
      <Calculator />
    </Router>,
  );
}
const result = (output: string): CalculationResult => ({
  input: "",
  output,
  approximate: false,
  resultIsComparison: false,
  messages: [],
});

describe("asynchronous calculator UI", () => {
  it("starts with one card and adds and focuses blank cards on Enter", () => {
    window.history.replaceState(null, "", "/#/calculator");
    mock.calculate.mockResolvedValue(result("60"));
    mount();
    const first = screen.getByRole("textbox", { name: "Expression 1" });
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    fireEvent.keyDown(first, { key: "Enter", isComposing: true });
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    fireEvent.keyDown(first, { key: "Enter" });
    const second = screen.getByRole("textbox", { name: "Expression 2" });
    expect(document.activeElement).toBe(second);
    expect((second as HTMLInputElement).value).toBe("");
    fireEvent.input(second, { target: { value: "2 + 2" } });
    fireEvent.keyDown(second, { key: "Enter" });
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Expression 3" }));
    const state = unpackState(
      new URLSearchParams(window.location.hash.split("?")[1]).get("s")!,
    ) as {
      tiles: { expression: string }[];
    };
    expect(state.tiles.map((tile) => tile.expression)).toEqual(["(12 + 8) * 3", "2 + 2", ""]);
    fireEvent.click(screen.getByRole("button", { name: "Remove expression 2" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Expression 2" }));
  });

  it("does not add a card on Enter when the maximum is reached", () => {
    window.history.replaceState(
      null,
      "",
      `/#/calculator?s=${packState({
        v: 1,
        tiles: Array.from({ length: MAX_TILES }, (_, index) => ({
          id: String(index),
          expression: "",
        })),
      })}`,
    );
    mount();
    const input = screen.getByRole("textbox", { name: "Expression 1" });
    input.focus();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getAllByRole("textbox")).toHaveLength(MAX_TILES);
    expect(document.activeElement).toBe(input);
  });

  it.each([false, true])("renders a comparison with approximate=%s", async (approximate) => {
    mock.calculate.mockResolvedValue({
      ...result("x = 2"),
      input: "x + 1 = 3",
      approximate,
      resultIsComparison: true,
    });
    mount();
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(`${approximate ? "≈" : "="} (x = 2)`),
    );
    expect(screen.getByLabelText("Interpreted expression").textContent).toBe("(x + 1 = 3)");
    expect(
      screen.getByRole("status").querySelector(".calculator-equality")?.getAttribute("style"),
    ).toBeNull();
  });

  it("shows the interpreted expression and renders coloured results", async () => {
    mock.calculate.mockResolvedValue({
      input:
        '<span style="color:#FFFFAA">x</span><sup>2</sup> + <span style="color:#AAFFFF">1</span>',
      output:
        '<span style="color:#FFFFAA">x</span><sup>2</sup> + <span style="color:#AAFFFF">1</span>',
      approximate: false,
      resultIsComparison: false,
      messages: [],
    });
    mount();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("= x2 + 1"));
    const interpretation = screen.getByLabelText("Interpreted expression");
    expect(interpretation.textContent).toBe("x2 + 1");
    expect(interpretation.querySelector("sup")?.textContent).toBe("2");
    expect(
      screen.getByRole("status").querySelector<HTMLSpanElement>("span[style]")?.style.color,
    ).toBe("#ffffaa");
  });

  it("filters the unit table, persists inputs, and restores filters from history", async () => {
    mock.calculate.mockResolvedValue(result("42"));
    mount();
    const table = screen.getByRole("table", { name: "Bundled libqalculate unit definitions" });
    const filter = screen.getByRole("searchbox", { name: "Filter units" });
    const originalHash = window.location.hash;
    fireEvent.input(filter, { target: { value: "Kibibyte" } });
    expect(within(table).getByRole("rowheader", { name: "Kibibyte" })).toBeTruthy();
    expect(within(table).queryByRole("rowheader", { name: "Meter" })).toBeNull();
    const filteredHash = window.location.hash;
    expect(unpackState(new URLSearchParams(filteredHash.split("?")[1]).get("s")!)).toEqual({
      v: 1,
      tiles: [{ id: "one", expression: "first" }],
      unitFilter: "Kibibyte",
    });
    fireEvent.input(filter, { target: { value: "no-matching-unit" } });
    expect(within(table).getByText("No units match this filter.")).toBeTruthy();
    await act(async () => {
      window.history.replaceState(null, "", `/${filteredHash}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect((filter as HTMLInputElement).value).toBe("Kibibyte");
    expect(within(table).getByRole("rowheader", { name: "Kibibyte" })).toBeTruthy();
    fireEvent.input(filter, { target: { value: "" } });
    expect(window.location.hash).toBe(originalHash);
    expect(within(table).getByRole("rowheader", { name: "Meter" })).toBeTruthy();
    expect(mock.calculate).toHaveBeenCalledOnce();
  });

  it("loads a shared unit filter without rewriting the URL", () => {
    window.history.replaceState(
      null,
      "",
      `/#/calculator?s=${packState({ v: 1, tiles: [], unitFilter: "Kibibyte" })}&note=keep`,
    );
    const originalUrl = window.location.href;
    mount();
    expect(
      (screen.getByRole("searchbox", { name: "Filter units" }) as HTMLInputElement).value,
    ).toBe("Kibibyte");
    expect(screen.getByRole("rowheader", { name: "Kibibyte" })).toBeTruthy();
    expect(window.location.href).toBe(originalUrl);
    fireEvent.input(screen.getByRole("searchbox", { name: "Filter units" }), {
      target: { value: "meter" },
    });
    expect(new URLSearchParams(window.location.hash.split("?")[1]).get("note")).toBe("keep");
  });

  it("dispatches edits immediately without waiting for a timer or paint", () => {
    mock.calculate.mockImplementation(() => new Promise(() => {}));
    mount();
    expect(mock.calculate).toHaveBeenCalledTimes(1);
    fireEvent.input(screen.getByRole("textbox", { name: "Expression 1" }), {
      target: { value: "2 + 2" },
    });
    expect(mock.calculate).toHaveBeenCalledTimes(2);
    expect(mock.calculate).toHaveBeenLastCalledWith("2 + 2", expect.any(AbortSignal));
  });

  it("keeps the old result while pending, then replaces it when ready", async () => {
    let resolveNext!: (value: CalculationResult) => void;
    mock.calculate.mockResolvedValueOnce(result("42")).mockImplementationOnce(
      () =>
        new Promise<CalculationResult>((resolve) => {
          resolveNext = resolve;
        }),
    );
    mount();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("= 42"));
    const output = screen.getByRole("status");
    fireEvent.input(screen.getByRole("textbox", { name: "Expression 1" }), {
      target: { value: "next" },
    });
    expect(output.textContent).toBe("= 42");
    expect(output.parentElement?.getAttribute("aria-busy")).toBe("true");
    await act(async () => {
      resolveNext(result("43"));
    });
    await waitFor(() => expect(output.textContent).toBe("= 43"));
    expect(output.parentElement?.getAttribute("aria-busy")).toBe("false");
    fireEvent.input(screen.getByRole("textbox", { name: "Expression 1" }), {
      target: { value: "" },
    });
    expect(output.textContent).toBe("Enter an expression");
    expect(output.parentElement?.getAttribute("aria-busy")).toBe("false");
  });

  it("persists edits immediately and ignores an obsolete calculation result", async () => {
    let resolveFirst!: (value: CalculationResult) => void;
    mock.calculate
      .mockImplementationOnce(
        () =>
          new Promise<CalculationResult>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(result("latest result"));
    mount();
    await waitFor(() => expect(mock.calculate).toHaveBeenCalledTimes(1));
    const oldSignal = mock.calculate.mock.calls[0][1] as AbortSignal;
    fireEvent.input(screen.getByRole("textbox", { name: "Expression 1" }), {
      target: { value: "latest" },
    });
    const payload = new URLSearchParams(window.location.hash.split("?")[1]).get("s")!;
    expect(unpackState(payload)).toEqual({ v: 1, tiles: [{ id: "one", expression: "latest" }] });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("= latest result"));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => {
      resolveFirst(result("obsolete result"));
    });
    expect(screen.getByRole("status").textContent).toBe("= latest result");
  });

  it("recovers from a loading failure without changing shared inputs", async () => {
    mock.calculate
      .mockRejectedValueOnce(new Error("Wasm failed to load"))
      .mockResolvedValueOnce(result("42"));
    const original = window.location.href;
    mount();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Wasm failed to load"));
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("= 42"));
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("false");
    expect(window.location.href).toBe(original);
  });

  it("shows warnings, cancels removed work and disposes on unmount", async () => {
    mock.calculate.mockResolvedValue({
      ...result("∞"),
      messages: [{ severity: "warning", text: "Division by zero." }],
    });
    const view = mount();
    await screen.findByText("Division by zero.");
    expect(screen.getByRole("status").textContent).toBe("= ∞");
    const requestSignal = mock.calculate.mock.calls[0][1] as AbortSignal;
    fireEvent.click(screen.getByRole("button", { name: "Remove expression 1" }));
    await waitFor(() => expect(requestSignal.aborted).toBe(true));
    view.unmount();
    expect(mock.dispose).toHaveBeenCalledOnce();
  });

  it("does not initialize WASM for blank tiles", async () => {
    window.history.replaceState(
      null,
      "",
      `/#/calculator?s=${packState({ v: 1, tiles: [{ id: "one", expression: "" }] })}`,
    );
    mount();
    expect(screen.getByRole("status").textContent).toBe("Enter an expression");
    expect(mock.calculate).not.toHaveBeenCalled();
  });
});

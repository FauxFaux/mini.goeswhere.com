// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Link, Router } from "wouter";
import { App } from "./app.tsx";
import { CrashHandler } from "./boot/crash-handler.tsx";
import { navigateHash, splitHash, useMiniLocation, useMiniSearch } from "./boot/hash-location.ts";
import { UrlHandler } from "./boot/url-handler.tsx";
import { packState, unpackState } from "./boot/url-state.ts";
import { calculatorCodec, type CalculatorState } from "./tools/calculator/state.ts";

// Routing and URL persistence do not depend on calculation results.
// Real WASM evaluation and calculator interactions have dedicated suites.
vi.mock("./tools/calculator/engine.ts", () => ({
  CalculatorEngine: class {
    async calculate() {
      return { input: "", output: "", approximate: false, resultIsComparison: false, messages: [] };
    }
    dispose() {}
  },
}));

beforeEach(() => {
  window.history.replaceState(null, "", "/#/");
});
afterEach(cleanup);

function savedState(): CalculatorState {
  const params = new URLSearchParams(splitHash(window.location.hash).search);
  return calculatorCodec.query!.decode(params);
}

describe("mini app routing and state", () => {
  it("opens tools from the directory and keeps state inside the hash", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: "Calculator" }));
    const input = await screen.findByRole("textbox", { name: "Expression 1" });
    await user.clear(input);
    await user.type(input, "2 + 3 * 4");
    expect(document.activeElement).toBe(input);
    expect(window.location.hash).toMatch(/^#\/calculator\?e=/);
    expect(window.location.search).toBe("");
    expect(savedState().tiles[0].expression).toBe("2 + 3 * 4");
  });

  it("restores shared state on initial load and later external hash changes", async () => {
    window.history.replaceState(null, "", "/#/calculator?e=6+*+7");
    const original = window.location.href;
    render(<App />);
    const input = await screen.findByRole("textbox", { name: "Expression 1" });
    expect((input as HTMLInputElement).value).toBe("6 * 7");
    expect(window.location.href).toBe(original);
    window.location.hash = "/calculator?e=9+%5E+2";
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("9 ^ 2"));
  });

  it("restores each tool’s edited state through Back and Forward navigation", async () => {
    const user = userEvent.setup();
    navigateHash("/calculator");
    render(<App />);
    const input = await screen.findByRole("textbox", { name: "Expression 1" });
    fireEvent.input(input, { target: { value: "40 + 2" } });
    await waitFor(() => expect(savedState().tiles[0].expression).toBe("40 + 2"));
    act(() => navigateHash("/hello-world"));
    const greeting = await screen.findByRole("textbox", { name: "Your name" });
    fireEvent.input(greeting, { target: { value: "History" } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Hello, History!"));
    window.history.back();
    const restored = await screen.findByRole("textbox", { name: "Expression 1" });
    expect((restored as HTMLInputElement).value).toBe("40 + 2");
    window.history.forward();
    const restoredGreeting = await screen.findByRole("textbox", { name: "Your name" });
    expect((restoredGreeting as HTMLInputElement).value).toBe("History");
    expect(screen.getByRole("status").textContent).toBe("Hello, History!");
    // An edit on the restored page must not leave a stale delayed URL write.
    await user.clear(restoredGreeting);
    await user.type(restoredGreeting, "Again");
    expect(screen.getByRole("status").textContent).toBe("Hello, Again!");
  });

  it("does not write defaults on load or add history entries while editing", async () => {
    navigateHash("/hello-world");
    const historyLength = window.history.length;
    render(<App />);
    const input = await screen.findByRole("textbox", { name: "Your name" });
    expect(window.location.hash).toBe("#/hello-world");
    fireEvent.input(input, { target: { value: "Zoë 🌍" } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Hello, Zoë 🌍!"));
    expect(window.history.length).toBe(historyLength);
    expect(
      unpackState(new URLSearchParams(splitHash(window.location.hash).search).get("s")!),
    ).toEqual({ v: 1, name: "Zoë 🌍" });
  });

  it.each([
    ["garbage!", "Corrupt URL state"],
    [packState({ v: 2, name: "saved" }), "Unrecognised state version"],
  ])("preserves invalid links and recovers within the tool", async (payload, heading) => {
    const user = userEvent.setup();
    navigateHash(`/hello-world?s=${payload}`);
    const original = window.location.href;
    render(<App />);
    await screen.findByRole("heading", { name: heading });
    expect(window.location.href).toBe(original);
    await user.click(screen.getByRole("link", { name: "Start fresh" }));
    await screen.findByRole("textbox", { name: "Your name" });
    expect(window.location.hash).toBe("#/hello-world");
  });

  it("preserves the document query and unrelated fragment parameters", async () => {
    window.history.replaceState(null, "", "/?host=value#/calculator?note=keep");
    render(<App />);
    const input = await screen.findByRole("textbox", { name: "Expression 1" });
    fireEvent.input(input, { target: { value: "42" } });
    await waitFor(() => expect(savedState().tiles[0].expression).toBe("42"));
    expect(window.location.search).toBe("?host=value");
    expect(new URLSearchParams(splitHash(window.location.hash).search).get("note")).toBe("keep");
  });

  it("composes functional updates and ignores setters after navigating to another tool", async () => {
    navigateHash("/calculator");
    let edit:
      | ((update: CalculatorState | ((previous: CalculatorState) => CalculatorState)) => void)
      | undefined;
    render(
      <Router hook={useMiniLocation} searchHook={useMiniSearch}>
        <UrlHandler codec={calculatorCodec}>
          {([state, setter]) => {
            edit = setter;
            return <p>{state.tiles.length} tiles</p>;
          }}
        </UrlHandler>
      </Router>,
    );
    const append = (previous: CalculatorState): CalculatorState => ({
      ...previous,
      tiles: [...previous.tiles, { id: `tile-${previous.tiles.length}`, expression: "" }],
    });
    act(() => {
      edit!(append);
      edit!(append);
    });
    expect(savedState().tiles.map((tile) => tile.expression)).toEqual(["(12 + 8) * 3", "", ""]);
    const staleEdit = edit!;
    act(() => {
      navigateHash("/hello-world");
      staleEdit(append);
    });
    expect(window.location.hash).toBe("#/hello-world");
  });

  it("shows a recoverable 404 instead of silently redirecting unknown routes", async () => {
    navigateHash("/missing?s=broken");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Tool not found" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse available tools" }).getAttribute("href")).toBe(
      "#/",
    );
  });

  it("catches render failures and resets the boundary after navigation", async () => {
    const crash = new Error("deliberate crash", { cause: new Error("root cause") });
    function Broken(): never {
      throw crash;
    }
    const props = { us: { v: 1, name: "saved" }, resetPath: "/hello-world", resetKey: "first" };
    const view = render(
      <CrashHandler {...props}>
        <Broken />
      </CrashHandler>,
    );
    await screen.findByRole("heading", { name: "Something went wrong" });
    expect(screen.getByText(/root cause/)).toBeTruthy();
    expect(screen.getByText(/"name": "saved"/)).toBeTruthy();
    view.rerender(
      <CrashHandler {...props} resetKey="second">
        <p>Recovered</p>
      </CrashHandler>,
    );
    await screen.findByText("Recovered");
  });

  it("uses hash query links as well as state writes", async () => {
    const user = userEvent.setup();
    render(
      <Router hook={useMiniLocation} searchHook={useMiniSearch}>
        <Link href="/hello-world?s=test">Shared greeting</Link>
      </Router>,
    );
    await user.click(screen.getByRole("link", { name: "Shared greeting" }));
    expect(window.location.hash).toBe("#/hello-world?s=test");
    expect(window.location.search).toBe("");
  });
});

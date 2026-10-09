// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeFiles } from "./analysis.ts";
import { analyze } from "./analyze.ts";
import { WasmExplorer } from "./page.tsx";
import { fixture } from "./test-fixtures.ts";

vi.mock("./analyze.ts", () => ({ analyze: vi.fn(async (input) => analyzeFiles(input)) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function upload(label: string, bytes: Uint8Array | string, name: string) {
  const file = new File([typeof bytes === "string" ? bytes : new Uint8Array(bytes)], name);
  Object.defineProperty(file, "arrayBuffer", {
    value: async () =>
      typeof bytes === "string"
        ? new TextEncoder().encode(bytes).buffer
        : new Uint8Array(bytes).buffer,
  });
  Object.defineProperty(file, "text", {
    value: async () => (typeof bytes === "string" ? bytes : new TextDecoder().decode(bytes)),
  });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
}

describe("WASM explorer interactions", () => {
  it("inspects a local binary, drills into code and filters names without fetching", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<WasmExplorer />);
    upload("WASM binary", fixture(), "local.wasm");
    await screen.findByRole("heading", { name: /local.wasm:/ });
    await user.type(
      screen.getByRole("searchbox", { name: "Search names and paths in this group" }),
      "named",
    );
    expect(screen.getByRole("button", { name: "Code / named", exact: true })).toBeTruthy();
    await user.clear(
      screen.getByRole("searchbox", { name: "Search names and paths in this group" }),
    );
    await user.click(screen.getByRole("button", { name: "Code", exact: true }));
    await user.click(screen.getByRole("button", { name: "named", exact: true }));
    expect(screen.getByText(/Function 1; file offset/)).toBeTruthy();
    await user.type(
      screen.getByRole("searchbox", { name: "Search names and paths in this group" }),
      "missing",
    );
    expect(screen.getByText("No entries in this group.")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("recovers from a corrupt symbol sidecar and accepts a matching sidecar", async () => {
    const user = userEvent.setup();
    render(<WasmExplorer />);
    upload("WASM binary", fixture(false), "local.wasm");
    await screen.findByRole("heading", { name: /local.wasm:/ });
    upload("Emscripten symbol map (.symbols)", "9:bad", "bad.symbols");
    expect((await screen.findByRole("alert")).textContent).toContain("outside this binary");
    await user.click(
      screen.getByRole("button", { name: "Remove Emscripten symbol map (.symbols)" }),
    );
    await screen.findByRole("heading", { name: /local.wasm:/ });
    upload("Emscripten symbol map (.symbols)", "1:Calculator::parse()", "good.symbols");
    await screen.findByRole("heading", { name: /local.wasm:/ });
    await user.selectOptions(screen.getByRole("combobox", { name: "Size view" }), "code");
    expect(screen.getByRole("button", { name: "Calculator::parse()", exact: true })).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Download without diagnostic metadata",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("reports a malformed binary locally and loads the bundled example on demand", async () => {
    const fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => fixture().buffer }));
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<WasmExplorer />);
    expect(fetch).not.toHaveBeenCalled();
    upload("WASM binary", new Uint8Array(8), "bad.wasm");
    expect((await screen.findByRole("alert")).textContent).toContain("version 1 binary");
    await user.click(screen.getByRole("button", { name: "Load this site’s qalculate.wasm" }));
    await screen.findByRole("heading", { name: /qalculate.wasm:/ });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("cancels worker analysis when the tool unmounts", async () => {
    const view = render(<WasmExplorer />);
    upload("WASM binary", fixture(), "local.wasm");
    await waitFor(() => expect(analyze).toHaveBeenCalled());
    const signal = vi.mocked(analyze).mock.calls[0][1];
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
});

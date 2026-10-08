import { describe, expect, it } from "vitest";
import { calculatorCodec, MAX_TILES } from "../tools/calculator/state.ts";
import { helloWorldCodec } from "../tools/hello-world/state.ts";
import { packState, readState, unpackState } from "./url-state.ts";

describe("URL state", () => {
  it("round-trips UTF-8 JSON using URL-safe base64", () => {
    const state = { v: 1, name: "Zoë 世界 🌍 + / ? # &" };
    const payload = packState(state);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(unpackState(payload)).toEqual(state);
    expect(readState(payload, helloWorldCodec)).toEqual({ kind: "ok", state });
  });

  it("round-trips calculator inputs including an empty grid", () => {
    for (const state of [calculatorCodec.defaultState, { v: 1, tiles: [] }]) {
      expect(readState(packState(state), calculatorCodec)).toEqual({ kind: "ok", state });
    }
  });

  it("uses defaults only when the parameter is absent", () => {
    expect(readState(null, calculatorCodec)).toEqual({
      kind: "ok",
      state: calculatorCodec.defaultState,
    });
    expect(readState("", calculatorCodec).kind).toBe("unpack-error");
  });

  it.each(["garbage!", "a", "not_base64_json", btoa("{"), "_w"])(
    "rejects malformed transport: %s",
    (payload) => {
      expect(readState(payload, calculatorCodec).kind).toBe("unpack-error");
    },
  );

  it("distinguishes unsupported versions from malformed state", () => {
    expect(readState(packState({ v: 2, tiles: [] }), calculatorCodec).kind).toBe("version-error");
    expect(readState(packState({ v: 1, tiles: "wrong" }), calculatorCodec).kind).toBe(
      "unpack-error",
    );
  });

  it.each([
    null,
    [],
    { v: 1 },
    { v: 1, tiles: [null] },
    { v: 1, tiles: [{ id: "", expression: "1" }] },
    { v: 1, tiles: [{ id: "a", expression: 1 }] },
    {
      v: 1,
      tiles: [
        { id: "a", expression: "1" },
        { id: "a", expression: "2" },
      ],
    },
    { v: 1, tiles: [{ id: "a", expression: "1".repeat(1001) }] },
    {
      v: 1,
      tiles: Array.from({ length: MAX_TILES + 1 }, (_, index) => ({
        id: String(index),
        expression: "",
      })),
    },
  ])("rejects unsafe calculator schemas: %j", (state) => {
    expect(readState(packState(state), calculatorCodec).kind).toBe("unpack-error");
  });

  it("validates the hello world schema independently", () => {
    expect(readState(packState(calculatorCodec.defaultState), helloWorldCodec).kind).toBe(
      "unpack-error",
    );
    expect(readState(packState({ v: 1, name: "x".repeat(101) }), helloWorldCodec).kind).toBe(
      "unpack-error",
    );
  });
});

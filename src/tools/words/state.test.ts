import { describe, expect, it } from "vitest";
import { readQueryState } from "../../boot/url-state.ts";
import { MAX_PATTERN_LENGTH, wordsCodec } from "./state.ts";

describe("words URL state", () => {
  it("round trips regex characters and preserves unrelated parameters", () => {
    const params = new URLSearchParams("other=keep");
    const state = { v: 1 as const, pattern: "^(café|a+b)\\w{2}$" };
    wordsCodec.query!.write(params, state);
    expect(readQueryState(new URLSearchParams(params.toString()), wordsCodec)).toEqual({
      kind: "ok",
      state,
    });
    expect(params.get("other")).toBe("keep");
  });

  it("defaults to an empty search and clears its own parameters", () => {
    const params = new URLSearchParams("q=cat&v=1&other=keep");
    wordsCodec.query!.write(params, wordsCodec.defaultState);
    expect(params.toString()).toBe("other=keep");
    expect(readQueryState(params, wordsCodec)).toEqual({
      kind: "ok",
      state: wordsCodec.defaultState,
    });
  });

  it("rejects unknown versions, duplicates and oversized inputs", () => {
    expect(readQueryState(new URLSearchParams("v=2"), wordsCodec).kind).toBe("version-error");
    expect(readQueryState(new URLSearchParams("q=a&q=b"), wordsCodec).kind).toBe("unpack-error");
    expect(() =>
      wordsCodec.decode({ v: 1, pattern: "a".repeat(MAX_PATTERN_LENGTH + 1) }),
    ).toThrow();
    expect(() => wordsCodec.decode({ v: 1, pattern: 3 })).toThrow();
    expect(() => wordsCodec.decode(null)).toThrow();
  });
});

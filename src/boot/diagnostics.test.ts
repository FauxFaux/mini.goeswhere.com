import { describe, expect, it } from "vitest";
import { describeError, formatDiagnostic } from "./diagnostics.ts";

describe("crash diagnostics", () => {
  it("includes stacks, custom properties, and nested causes", () => {
    const root = Object.assign(new Error("root"), { code: "BAD_INPUT" });
    const outer = new Error("outer", { cause: root });
    const report = describeError(outer);
    expect(report).toContain("outer");
    expect(report).toContain("root");
    expect(report).toContain("BAD_INPUT");
    expect(report).toContain("stack");
  });

  it("bounds chains and stops circular causes", () => {
    const cycle = new Error("cycle");
    cycle.cause = cycle;
    expect(describeError(cycle)).toContain("[Circular cause]");
    let error = new Error("hidden root");
    for (let index = 0; index < 12; index++)
      error = new Error(`wrapper ${index}`, { cause: error });
    expect(describeError(error)).toContain("[Further causes omitted]");
    expect(describeError(error)).not.toContain("hidden root");
  });

  it.each([null, undefined, 0, false, "string throw", 12n])(
    "handles non-Error throws: %s",
    (error) => {
      expect(typeof describeError(error)).toBe("string");
    },
  );

  it("handles circular state, bigints, and getters that throw", () => {
    const state: { value: bigint; self?: unknown } = { value: 1n };
    state.self = state;
    expect(formatDiagnostic(state)).toContain("[Circular]");
    expect(formatDiagnostic(state)).toContain("1n");
    const broken = {
      get bad() {
        throw new Error("getter");
      },
    };
    expect(formatDiagnostic(broken)).toContain("Could not serialize");
    expect(describeError(broken)).toContain("Could not inspect");
  });
});

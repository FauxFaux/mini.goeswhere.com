import { beforeAll, describe, expect, it } from "vitest";
import type { QalculateModule } from "../../assets/qalculate.mjs";
import { evaluateExpression } from "./evaluate.ts";
import { loadTestCalculator } from "./test-runtime.ts";

let calculator: QalculateModule;
beforeAll(async () => {
  calculator = await loadTestCalculator();
});
const evaluate = (expression: string) =>
  evaluateExpression(
    expression,
    async (input) => calculator.calculate(input, 2000),
    new AbortController().signal,
  );

describe("libqalculate expression evaluation", () => {
  it.each([
    ["2 + 3 * 4", "14"],
    ["(2 + 3) * 4", "20"],
    ["2 ^ 3 ^ 2", "512"],
    ["sqrt(144) + max(3, 7)", "19"],
    ["sin(pi / 2)", "1"],
    ["ln(e)", "1"],
    ["log(100, 10)", "2"],
    ["-5 + 2", "−3"],
    ["(2^100 + 1) - 2^100", "1"],
    ["sqrt(2)", "1.4142136"],
    ["1 m + 5 mm", "1.005 m"],
    ["10 kg to g", "10000 g"],
    ["diff(x^3, x)", "3x²"],
    ["sqrt(-1)", "i"],
  ])("evaluates %s", async (expression, value) => {
    expect(await evaluate(expression)).toEqual({ kind: "ok", value, messages: [] });
  });

  it.each(["", "   "])("does not load the engine for blank input", async (expression) => {
    expect(
      await evaluateExpression(
        expression,
        () => {
          throw new Error("Must not load");
        },
        new AbortController().signal,
      ),
    ).toEqual({ kind: "empty" });
  });

  it("shows all errors and clears diagnostics before the next calculation", async () => {
    const result = await evaluate("sin() + log()");
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("sin");
      expect(result.message).toContain("log");
    }
    expect(await evaluate("1 + 1")).toEqual({ kind: "ok", value: "2", messages: [] });
  });

  it("preserves warnings alongside the result", async () => {
    const result = await evaluate("1 / 0");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok")
      expect(result.messages).toContainEqual({ severity: "warning", text: "Division by zero." });
  });

  it("reports load and runtime failures locally", async () => {
    expect(
      await evaluateExpression(
        "1+1",
        async () => {
          throw new Error("Wasm could not load");
        },
        new AbortController().signal,
      ),
    ).toEqual({ kind: "error", message: "Wasm could not load" });
  });
});

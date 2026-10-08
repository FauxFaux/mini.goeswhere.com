// @vitest-environment happy-dom
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
    ["diff(x^3, x)", "3x2"],
    ["sqrt(-1)", "i"],
  ])("evaluates %s", async (expression, value) => {
    const result = await evaluate(expression);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(new DOMParser().parseFromString(result.value, "text/html").body.textContent).toBe(
        value,
      );
      expect(result.input).toBeTruthy();
      expect(result.messages).toEqual([]);
    }
  });

  it("returns coloured interpretations and formatted results from the shipped WASM", async () => {
    const result = await evaluate("x^2 + 2 m");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.input).toContain('<span style="color:#FFFFAA">');
      expect(result.input).toContain('<span style="color:#AAFFFF">');
      expect(result.input).toContain('<span style="color:#BBFFBB">');
      expect(result.input).toContain("<sup>");
      expect(result.value).toContain("<sup>");
    }
  });

  it.each([
    ["1+1", false, false],
    ["sqrt(2)", true, false],
    ["1/3 to decimals", true, false],
    ["x + 1 = 3", false, true],
    ["x^2 = 4", false, true],
  ])(
    "exposes approximation and comparison flags for %s",
    async (expression, approximate, resultIsComparison) => {
      expect(await evaluate(expression)).toMatchObject({
        kind: "ok",
        approximate,
        resultIsComparison,
      });
    },
  );

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
    expect(await evaluate("1 + 1")).toMatchObject({ kind: "ok", messages: [] });
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

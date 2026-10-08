import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./evaluate.ts";

describe("expression evaluation", () => {
  it.each([
    ["2 + 3 * 4", 14],
    ["(2 + 3) * 4", 20],
    ["2 ^ 3 ^ 2", 512],
    ["sqrt(144) + max(3, 7)", 19],
    ["sin(pi / 2)", 1],
    ["ln(e)", 1],
    ["log(100)", 2],
    ["min(4, 2) + 10 % 3", 3],
    ["-5 + 2", -3],
  ])("evaluates %s", (expression, value) => {
    expect(evaluateExpression(expression)).toEqual({ kind: "ok", value });
  });

  it.each(["", "   "])("treats blank input as an empty tile", (expression) => {
    expect(evaluateExpression(expression)).toEqual({ kind: "empty" });
  });

  it.each(["2 +", "sqrt(", "hello", "alert(1)", "1 / 0", "sqrt(-1)", "0 / 0"])(
    "reports an error for %s",
    (expression) => {
      expect(evaluateExpression(expression).kind).toBe("error");
    },
  );
});

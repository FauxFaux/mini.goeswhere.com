import calculator from "advanced-calculator";

export type ExpressionResult =
  | { kind: "empty" }
  | { kind: "ok"; value: number }
  | { kind: "error"; message: string };

export function evaluateExpression(expression: string): ExpressionResult {
  const input = expression.trim();
  if (!input) return { kind: "empty" };
  try {
    const value = calculator.evaluate(input);
    if (typeof value !== "number") return { kind: "error", message: "Invalid expression" };
    if (!Number.isFinite(value)) return { kind: "error", message: "No finite real result" };
    return { kind: "ok", value };
  } catch {
    return { kind: "error", message: "Invalid expression" };
  }
}

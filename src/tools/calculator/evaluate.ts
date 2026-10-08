import type { CalculationResult } from "../../assets/qalculate.mjs";

export type ExpressionResult =
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "ok"; value: string; messages: CalculationResult["messages"] }
  | { kind: "error"; message: string };

type Calculate = (expression: string, signal: AbortSignal) => Promise<CalculationResult>;

export async function evaluateExpression(
  expression: string,
  calculate: Calculate,
  signal: AbortSignal,
): Promise<ExpressionResult> {
  const input = expression.trim();
  if (!input) return { kind: "empty" };
  try {
    const result = await calculate(input, signal);
    const errors = result.messages.filter((message) => message.severity === "error");
    if (errors.length)
      return { kind: "error", message: errors.map((error) => error.text).join(" ") };
    return { kind: "ok", value: result.output, messages: result.messages };
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "Calculation failed",
    };
  }
}

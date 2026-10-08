import type { CalculationResult } from "../../assets/qalculate.mjs";

export type ExpressionResult =
  | { kind: "empty" }
  | { kind: "loading" }
  | {
      kind: "ok";
      input: string;
      value: string;
      approximate: boolean;
      resultIsComparison: boolean;
      messages: CalculationResult["messages"];
    }
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
    return {
      kind: "ok",
      input: result.input,
      value: result.output,
      approximate: result.approximate,
      resultIsComparison: result.resultIsComparison,
      messages: result.messages,
    };
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "Calculation failed",
    };
  }
}

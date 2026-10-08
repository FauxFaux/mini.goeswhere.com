export interface CalculationResult {
  /** Interpreted expression as libqalculate HTML, using the bright colour palette. */
  input: string;
  /** Calculated result as libqalculate HTML. Render through an allowlist. */
  output: string;
  /** Whether the displayed result is approximate, including rounding. */
  approximate: boolean;
  /** Whether the result contains comparisons or logical combinations. */
  resultIsComparison: boolean;
  messages: Array<{ severity: "error" | "warning" | "info"; text: string }>;
}
export interface QalculateModule {
  calculate(expression: string, timeoutMs: number): CalculationResult;
}
export default function createQalculate(options?: {
  locateFile?: (path: string, prefix: string) => string;
  wasmBinary?: Uint8Array;
}): Promise<QalculateModule>;

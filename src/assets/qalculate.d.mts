export interface CalculationResult {
  input: string;
  output: string;
  messages: Array<{ severity: "error" | "warning" | "info"; text: string }>;
}
export interface QalculateModule {
  calculate(expression: string, timeoutMs: number): CalculationResult;
}
export default function createQalculate(options?: {
  locateFile?: (path: string, prefix: string) => string;
  wasmBinary?: Uint8Array;
}): Promise<QalculateModule>;

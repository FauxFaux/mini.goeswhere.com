import createQalculate from "../../assets/qalculate.mjs";
import wasmUrl from "../../assets/qalculate.wasm?url";
import type { WorkerReply } from "./engine.ts";

// DOM and worker libraries overlap; only the message API is needed here.
const worker = self as unknown as {
  onmessage:
    | ((event: MessageEvent<{ id: number; expression: string; timeoutMs: number }>) => void)
    | null;
  postMessage: (reply: WorkerReply) => void;
};
try {
  const calculator = await createQalculate({ locateFile: () => wasmUrl });
  worker.onmessage = ({ data: { id, expression, timeoutMs } }) => {
    try {
      worker.postMessage({ id, result: calculator.calculate(expression, timeoutMs) });
    } catch (error) {
      // A runtime trap may leave the module unusable. The parent replaces it.
      worker.postMessage({ error: error instanceof Error ? error.message : String(error) });
    }
  };
  worker.postMessage({ ready: true });
} catch (error) {
  worker.postMessage({ error: error instanceof Error ? error.message : String(error) });
}

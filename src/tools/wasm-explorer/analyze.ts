import type { Analysis, AnalysisInput } from "./analysis.ts";

export function analyze(input: AnalysisInput, signal: AbortSignal): Promise<Analysis> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Analysis cancelled."));
      return;
    }
    const worker = new Worker(new URL("./analyzer.worker.ts", import.meta.url), { type: "module" });
    function finish() {
      worker.terminate();
      signal.removeEventListener("abort", cancel);
    }
    function cancel() {
      finish();
      reject(new Error("Analysis cancelled."));
    }
    signal.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: Analysis; error?: string }>) => {
      finish();
      if (event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error ?? "Analysis failed."));
    };
    worker.onerror = () => {
      finish();
      reject(new Error("The analysis worker failed."));
    };
    // Copy once: keep the original bytes available for preview and stripping.
    worker.postMessage(input);
  });
}

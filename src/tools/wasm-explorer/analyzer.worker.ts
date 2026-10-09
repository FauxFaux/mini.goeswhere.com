import { analyzeFiles, type AnalysisInput } from "./analysis.ts";

self.onmessage = (event: MessageEvent<AnalysisInput>) => {
  try {
    self.postMessage({ result: analyzeFiles(event.data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};

import productionWasmUrl from "../../assets/qalculate.wasm?url";
import productionSymbolsUrl from "../../assets/qalculate-analysis/production/qalculate.mjs.symbols?url";
import productionLinkerMapUrl from "../../assets/qalculate-analysis/production/qalculate.linker-map.txt?url";
import debugWasmUrl from "../../assets/qalculate-analysis/debug/qalculate.wasm?url";
import debugSymbolsUrl from "../../assets/qalculate-analysis/debug/qalculate.mjs.symbols?url";
import debugLinkerMapUrl from "../../assets/qalculate-analysis/debug/qalculate.linker-map.txt?url";
import type { AnalysisInput } from "./analysis.ts";

// Vite's dev middleware serves .map requests as JSON before handling ?url imports.
// Refer to the map as a fetched asset instead of importing it as a JS module.
const debugSourceMapUrl = new URL(
  "../../assets/qalculate-analysis/debug/qalculate.wasm.map",
  import.meta.url,
).href;

export type LoadedFiles = AnalysisInput & { name: string };
type Example = {
  name: string;
  label: string;
  wasmUrl: string;
  symbolsUrl: string;
  linkerMapUrl: string;
  sourceMapUrl?: string;
};

export const examples: Example[] = [
  {
    name: "qalculate.wasm",
    label: "Load this site’s qalculate.wasm (without debug info)",
    wasmUrl: productionWasmUrl,
    symbolsUrl: productionSymbolsUrl,
    linkerMapUrl: productionLinkerMapUrl,
  },
  {
    name: "qalculate-debug.wasm",
    label: "Load this site’s qalculate.wasm (with debug info)",
    wasmUrl: debugWasmUrl,
    symbolsUrl: debugSymbolsUrl,
    linkerMapUrl: debugLinkerMapUrl,
    sourceMapUrl: debugSourceMapUrl,
  },
];

export async function loadExample(example: Example, signal: AbortSignal): Promise<LoadedFiles> {
  async function response(url: string) {
    const result = await fetch(url, { signal });
    if (!result.ok) throw new Error(`Could not load example asset (${result.status}): ${url}`);
    return result;
  }
  const [bytes, symbols, linkerMap, sourceMap] = await Promise.all([
    response(example.wasmUrl).then(async (result) => new Uint8Array(await result.arrayBuffer())),
    response(example.symbolsUrl).then((result) => result.text()),
    response(example.linkerMapUrl).then((result) => result.text()),
    example.sourceMapUrl
      ? response(example.sourceMapUrl).then((result) => result.text())
      : undefined,
  ]);
  return { name: example.name, bytes, symbols, linkerMap, sourceMap };
}

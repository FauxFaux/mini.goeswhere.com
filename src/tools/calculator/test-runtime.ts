import { readFile } from "node:fs/promises";
import vm from "node:vm";
import type createQalculate from "../../assets/qalculate.mjs";
import type { QalculateModule } from "../../assets/qalculate.mjs";

/** Exercise the shipped browser-only loader and WASM without adding Node support to it. */
export async function loadTestCalculator(): Promise<QalculateModule> {
  const [source, wasmBinary] = await Promise.all([
    readFile(`${process.cwd()}/src/assets/qalculate.mjs`, "utf8"),
    readFile(`${process.cwd()}/src/assets/qalculate.wasm`),
  ]);
  const scope = {
    console,
    setTimeout,
    clearTimeout,
    performance,
    URL,
    TextDecoder,
    TextEncoder,
    WebAssembly,
    WorkerGlobalScope: class {},
    navigator: { userAgent: "wasm-test" },
    location: { href: "https://example.test/assets/qalculate.mjs" },
  };
  const context = vm.createContext({ ...scope, self: scope });
  const module = new vm.SourceTextModule(source, {
    context,
    initializeImportMeta: (meta) => {
      meta.url = scope.location.href;
    },
  });
  await module.link((specifier) => {
    throw new Error(`Unexpected import in browser WASM loader: ${specifier}`);
  });
  await module.evaluate();
  const create = (module.namespace as { default: typeof createQalculate }).default;
  return create({ wasmBinary });
}

import { readFileSync } from "node:fs";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { createServer, type ViteDevServer } from "vite";
import { describe, expect, it } from "vitest";
import { analyzeFiles } from "./analysis.ts";

function asset(path: string): Buffer {
  return readFileSync(new URL(`../../assets/${path}`, import.meta.url));
}

// Exercise dev middleware in memory: no listening port or browser is needed.
function devRequest(server: ViteDevServer, url: string, destination: "script" | "empty") {
  return new Promise<{ contentType: string; body: string }>((resolve, reject) => {
    const request = new IncomingMessage(new Socket());
    request.method = "GET";
    request.url = url;
    request.headers = { host: "localhost", "sec-fetch-dest": destination };
    const response = new ServerResponse(request);
    const chunks: Buffer[] = [];
    response.write = (chunk: unknown) => {
      if (typeof chunk === "string" || chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk));
      return true;
    };
    response.end = (chunk?: unknown) => {
      if (typeof chunk === "string" || chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk));
      resolve({
        contentType: String(response.getHeader("content-type")),
        body: Buffer.concat(chunks).toString(),
      });
      return response;
    };
    server.middlewares(request, response, (error?: unknown) =>
      reject(error ?? new Error(`No response for ${url}`)),
    );
  });
}

describe("committed WASM examples", () => {
  it("serves the example module as JavaScript and fetches its source map as JSON in dev mode", async () => {
    const server = await createServer({
      configFile: false,
      server: { middlewareMode: true, watch: null, ws: false },
      appType: "custom",
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const module = await devRequest(server, "/src/tools/wasm-explorer/examples.ts", "script");
      expect(module.contentType).toContain("javascript");
      expect(module.body).not.toMatch(/import[^;]*\.wasm\.map\?url/);
      const match = /new URL\("([^\"]+\.wasm\.map)"/.exec(module.body);
      expect(match).not.toBeNull();
      const map = await devRequest(server, match![1], "empty");
      expect(map.contentType).toContain("application/json");
      expect(map.body).toBe(asset("qalculate-analysis/debug/qalculate.wasm.map").toString());
    } finally {
      await server.close();
    }
  });
  it("pairs production with symbols from the identical binary and its linker map", () => {
    const bytes = new Uint8Array(asset("qalculate.wasm"));
    const analysis = analyzeFiles({
      bytes,
      symbols: asset("qalculate-analysis/production/qalculate.mjs.symbols").toString(),
      linkerMap: asset("qalculate-analysis/production/qalculate.linker-map.txt").toString(),
    });
    expect(analysis.report.functions[0].name).toBe("__wasm_call_ctors");
    expect(analysis.report.functions.find((fn) => fn.index === 416)?.name).toContain(
      "Calculator::loadDefinitions",
    );
    expect(analysis.report.sections.filter((section) => section.id === 0)).toEqual([]);
    expect(analysis.symbolCount).toBe(4458);
    expect(analysis.linker!.size).toBeGreaterThan(0);
  });

  it("pairs the debug binary with its source map, symbols and linker map", () => {
    const directory = "qalculate-analysis/debug/";
    const analysis = analyzeFiles({
      bytes: new Uint8Array(asset(directory + "qalculate.wasm")),
      symbols: asset(directory + "qalculate.mjs.symbols").toString(),
      sourceMap: asset(directory + "qalculate.wasm.map").toString(),
      linkerMap: asset(directory + "qalculate.linker-map.txt").toString(),
    });
    expect(analysis.report.sections.some((section) => section.name === ".debug_info")).toBe(true);
    expect(analysis.symbolCount).toBe(7200);
    expect(analysis.mappedBytes).toBe(3370527);
    expect(analysis.sources!.size).toBe(analysis.report.size);
    expect(analysis.linker!.size).toBeGreaterThan(0);
  });
});

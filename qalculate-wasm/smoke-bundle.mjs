import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { Window } from "happy-dom";
const htmlWindow = new Window();
const assets = path.resolve("dist/assets");
const files = await readdir(assets);
const entry = files.find((name) => /^calculator\.worker-.*\.js$/.test(name));
assert.ok(entry, "Run npm run build before the worker smoke check");
let readyResolve, readyReject;
const ready = new Promise((resolve, reject) => {
  readyResolve = resolve;
  readyReject = reject;
});
let replyResolve, replyReject;
const requests = [];
const scope = {
  console,
  setTimeout,
  clearTimeout,
  URL,
  TextDecoder,
  TextEncoder,
  performance,
  WebAssembly,
  WorkerGlobalScope: class {},
  navigator: { userAgent: "wasm-smoke" },
  location: { href: `https://example.test/assets/${entry}` },
  fetch: async (url) => {
    requests.push(String(url));
    return new Response(await readFile(path.join(assets, path.basename(String(url)))), {
      headers: { "Content-Type": "application/wasm" },
    });
  },
  postMessage: (data) => {
    if (data.error) {
      const error = new Error(data.error);
      if (replyReject) replyReject(error);
      else readyReject(error);
    } else if (data.ready) readyResolve();
    else replyResolve(data);
  },
};
scope.self = scope;
const context = vm.createContext(scope);
const modules = new Map();
async function load(name) {
  assert.ok(
    !name.includes("browser-external"),
    "Worker must not import browser-external Node shims",
  );
  if (modules.has(name)) return modules.get(name);
  const source = await readFile(path.join(assets, name), "utf8");
  assert.ok(!source.includes("node:module"), "Worker must not import node:module");
  const mod = new vm.SourceTextModule(source, {
    context,
    identifier: `https://example.test/assets/${name}`,
    initializeImportMeta: (meta) => {
      meta.url = `https://example.test/assets/${name}`;
    },
  });
  modules.set(name, mod);
  await mod.link((specifier) => load(path.basename(specifier)));
  return mod;
}
// Use the browser/worker loader branch, without Node globals or a web server.
const deadline = setTimeout(() => {
  throw new Error("Production worker smoke timed out");
}, 30000);
const mod = await load(entry);
await mod.evaluate();
await ready;
assert.equal(requests.length, 1);
assert.match(requests[0], /qalculate-.*\.wasm$/);
let id = 0;
for (const [expression, expected, approximate, resultIsComparison] of [
  ["1+1", "2", false, false],
  ["1 m + 5 mm", "1.005 m", false, false],
  ["diff(x^3,x)", "3x2", false, false],
  ["sqrt(2)", "1.4142136", true, false],
  ["x+1=3", "x = 2", false, true],
]) {
  const response = new Promise((resolve, reject) => {
    replyResolve = resolve;
    replyReject = reject;
  });
  scope.onmessage({ data: { id: ++id, expression, timeoutMs: 2000 } });
  const data = await response;
  assert.equal(data.id, id);
  assert.equal(
    new htmlWindow.DOMParser().parseFromString(data.result.output, "text/html").body.textContent,
    expected,
  );
  assert.match(data.result.output, /<span style="color:/);
  assert.match(data.result.input, /<span style="color:/);
  assert.equal(data.result.approximate, approximate);
  assert.equal(data.result.resultIsComparison, resultIsComparison);
  assert.equal(data.result.messages.length, 0);
}
clearTimeout(deadline);
await htmlWindow.happyDOM.close();
console.log(
  "Production worker smoke passed: browser runtime, hashed wasm URL, arithmetic, units, differentiation.",
);

# libqalculate WebAssembly

For binary inspection, source attribution, analysis builds and stripping, see
[ANALYSIS.md](ANALYSIS.md) and the site's `#/wasm-explorer` tool.

Rebuild from the repository root with `npm run build:qalculate-wasm` (Docker/BuildKit).
The scratch export writes these committed files into `src/assets/`:

- `qalculate.wasm`: calculator, embedded definitions, and bundled exchange rates.
- `qalculate.mjs` and `qalculate.d.mts`: Emscripten loader and Embind declarations.

The build fetches libqalculate 5.13.1 at commit
`b245c4194a1a8dc14ba7ecf1e811e6d0b60592aa` from
https://github.com/Qalculate/libqalculate, using Emscripten 6.0.10, GMP 6.3.0,
MPFR 4.2.1, and libxml2 2.14.6. Container tags and apt packages are not digest
pinned, so the build is version pinned rather than bit-for-bit reproducible.
Dependency layers precede the library build. The build recipe is derived from
`~/clone/libqalculate/wasm`, following `../quad-image/webp-wasm`'s Docker export.
No checkout outside this repository is required to rebuild.

The calculator creates a module worker on its first nonblank expression, so
other tools never download or initialize WASM. Vite emits hashed worker and
WASM URLs, including when built with a non-root base. There is one module
instance per mounted calculator: libqalculate uses a global calculator pointer.
The worker is terminated on navigation or fatal failure, and Retry creates a
fresh runtime. No SharedArrayBuffer or cross-origin isolation is required.

`calculate(expression, timeoutMs)` returns HTML `input` (the interpreted expression) and `output`, plus
plain-text `messages` with error, warning, or info severity. The `approximate`
and `resultIsComparison` flags drive the equality sign and comparison parentheses. HTML uses the bright
colour palette for dark backgrounds. The UI renders only supported formatting tags
and allowlisted colours/styles; it never inserts the returned HTML directly. Angles use radians, unknown
symbols support algebra, and approximate results default to eight significant
digits. Errors are shown locally; warnings accompany results. Calculations
are dispatched immediately after edits, run sequentially, and obsolete queued
requests are cancelled. URL inputs are still persisted synchronously. The library gets a two-second
cooperative timeout; a five-second worker deadline catches uncooperative
paths. Initialization has a separate thirty-second deadline.

Exchange rates are embedded snapshots; there are no rate updates. Curl,
command execution, gnuplot, ICU, translations, and host filesystem access are
disabled. A runtime trap discards the worker. Emscripten retains its in-memory
filesystem and a 16 MiB stack. The generated loader targets only `web,worker`,
so it contains no Node loader imports. The generated `.mjs` is excluded from Oxfmt.
Real WASM domain and UI tests use an isolated worker-like VM rather than a
Node-targeted calculator build. `npm test` enables Node's experimental VM modules
for this test harness; the shipped runtime does not depend on Node.

Run `npm test` for real WASM calculations, worker lifecycle, UI races, and URL
restoration checks. Run `npm run lint` and `npm run build` for integration checks. After building,
`npm run test:qalculate-bundle` runs the emitted worker in an isolated worker-like
VM with the browser loader branch, fetching the emitted WASM asset. It checks
arithmetic, units, and differentiation without starting a server or browser.

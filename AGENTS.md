# Repository guidelines

This is a collection of small calculators, tools, and explainers built with Preact, TypeScript,
and Vite. It is a static site with a tool directory at `#/` and independent wouter mini apps.
Keep styling minimal and dark only. Use system fonts, native controls, and plain CSS; no stock
logos, decorative assets, theme switching, or UI framework.

## Structure

- `src/main.tsx` mounts the application and imports global styles from `src/index.css`.
- `src/app.tsx` owns the shared navigation, wouter router, and 404 page.
- `src/pages/` contains site pages such as the tool directory.
- `src/tools/registry.ts` is the single catalogue for routes, titles, descriptions, and direct imports.
- `src/tools/<slug>/page.tsx` is a tool's entry point. Keep its UI, domain functions, state codec,
  tests, and optional CSS together in that directory. Avoid importing one tool from another.
- `src/boot/` contains routing, URL transport, and crash recovery shared by all tools. It must
  not import tool-specific state or algorithms.
- `qalculate-wasm/` contains the pinned Docker build and Embind API for libqalculate.
  `npm run build:qalculate-wasm` exports its runtime, WASM, and license into `src/assets/`. Keep the generated loader out of formatting.

Use `src/tools/calculator/` as the worked example and `src/tools/hello-world/` as the smallest
example. Add shared components or utilities only when multiple tools need them.

## Adding a tool

1. Create `src/tools/<slug>/page.tsx` with a named component and import it directly in the registry.
   The directory listing and route then appear together. Use stable, lowercase kebab-case slugs.
2. If the tool has shareable inputs, define its own named state type (for example
   `CalculatorState`) and `UrlCodec<T>` in `state.ts`. Wrap its UI in `UrlHandler` and pass the
   `[value, setter]` tuple (`State<T>`) to components. A static explainer can omit URL state.
3. Keep pure calculations separate from Preact components and test meaningful domain behavior.
   Put component-specific CSS beside the component and prefix classes with the tool slug.

## URL state and compatibility

State lives in the fragment query, for example `#/analogue-clock?s=36600&t=1`.
Choose a transport appropriate to the tool: readable query parameters via `UrlCodec.query`
work well for simple inputs; the default transport uses `s` as unpadded base64url of UTF-8 JSON
for structured state. Query codecs own their parameter names: the analogue clock uses `s` for
integer seconds through the current year, with `h`, `t`, and `m` for 12-hour, 24-hour, and
minute labels, plus `b` for the side-by-side layout. There is no compression or shared application-wide state. Each tool owns
its schema and version; the route identifies the tool. Persist inputs only, not results, focus,
hover, or other transient UI state. Base64 is an encoding, not encryption; URLs must not hold secrets.

`hash-location.ts` adapts wouter's `useHashLocation` subscription: queries remain inside the
fragment, and routing sees only the pathname. Use wouter `Link`, `useLocation`, and `useSearch`
inside the configured router. Do not use wouter's stock hash navigator for state writes: this
installed version moves query parameters to the document's search string.

`UrlHandler` reads initial links and subsequent hash/history changes. The URL is the persisted
source of truth. Edits replace the current history entry; tool navigation pushes an entry, so
Back returns to the previous tool with its last edited state. Reads never rewrite the URL.
For frequent edits such as dragging, pass `debounceMs` to `UrlHandler`: the UI updates immediately
while URL writes wait for a pause or the end of a pointer gesture. Functional setters compose
against pending edits, then the current URL. Pending edits flush before app navigation and on
page hiding; external hash/history changes discard them. Delayed writes must verify their
originating URL and never overwrite incoming links or another tool. Preserve unrelated fragment
query parameters when writing state.

Treat shared links as a public format. Prefer compatible optional fields with defaults applied
by the tool's decoder. When a breaking change is necessary, bump that tool's `v` and migrate
older versions in its decoder where practical. Decode `unknown` defensively: validate structure,
types, size limits, and identity constraints before passing data to UI or calculations. Unknown
versions and corrupt payloads show a recovery link and preserve the original URL for diagnosis;
do not silently discard them. Keep UI input limits and decoding limits consistent.

## Crash recovery

`UrlHandler` wraps each tool UI in `CrashHandler` and passes its current state. The app also has
a boundary for failures in the shell. Recovery clears only the current tool's
fragment state and reloads. Report the URL, state, component stack, and at most ten error causes.
Diagnostics must tolerate non-Error throws, falsy throws, circular values, bigints, and broken
getters without crashing the fallback. URL parsing happens defensively before the tool mounts.
Catch expected calculation errors locally so one malformed expression does not break the page.

## Commands and verification

Use Node 24 on `PATH` and npm with the committed `package-lock.json`.

- `npm ci` installs the locked dependencies.
- `npm run dev` starts Vite.
- `npm run format` applies Oxfmt.
- `npm run lint` checks formatting and TypeScript (the lint script does not run ESLint).
- `npm test` runs Vitest once; `npm test -- src/tools/calculator/evaluate.test.ts` focuses a suite.
- `npm run build` checks TypeScript and builds `dist/`.
- `npm run preview` serves the production bundle.

Before handing off a change, run format, lint, relevant tests, and build. Tests live beside their
source as `*.test.ts` or `*.test.tsx`. Interaction tests use `@testing-library/preact`, user-event,
and a `// @vitest-environment happy-dom` directive. Prefer accessible role and label queries.
Cover URL round trips, malformed state, restoration/history, and meaningful calculation behavior
when changing those areas. Do not add tests that merely duplicate trivial presentation markup.
Do not start a Vite server or browser unless the user asks; use automated tests and production
builds for routine validation.

## Coding conventions

Write strict TypeScript and functional Preact components. Import hooks from `preact/hooks`;
use `preact/compat` only at compatibility boundaries such as React dependencies.
Use `class` in Preact JSX, type-only imports, explicit `.ts`/`.tsx` local import extensions,
camelCase for values, PascalCase for types/components, and kebab-case filenames. Keep state
updates immutable and calculations pure. Use libqalculate in the calculator’s worker to evaluate expressions; do not execute user text with JavaScript `eval` or `Function`.

Let Oxfmt format the code. Preserve unrelated changes. Use focused Conventional Commit subjects
if asked to commit, and describe behavior and validation in PRs.

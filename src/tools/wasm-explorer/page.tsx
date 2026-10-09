import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Analysis } from "./analysis.ts";
import { analyze } from "./analyze.ts";
import {
  dataPreview,
  isDiagnosticSection,
  MAX_SIDECAR_BYTES,
  MAX_WASM_BYTES,
  stripDiagnostics,
} from "./binary.ts";
import { Guidance } from "./guidance.tsx";
import { examples, loadExample, type LoadedFiles } from "./examples.ts";
import { searchTree, squarify, type SizeNode } from "./treemap.ts";
import "./wasm-explorer.css";

type View = "sections" | "code" | "data" | "sources" | "linker" | "bss";
const viewLabels: Record<View, string> = {
  sections: "Whole binary / sections",
  code: "Function entries",
  data: "Data segments",
  sources: "Final code by source path",
  linker: "Linker libraries / objects / symbols",
  bss: "Linker BSS memory",
};

function bytesLabel(size: number): string {
  return `${size.toLocaleString()} B${size >= 1024 ? ` (${(size / 1024 ** (size >= 1024 * 1024 ? 2 : 1)).toFixed(2)} ${size >= 1024 * 1024 ? "MiB" : "KiB"})` : ""}`;
}

function save(bytes: Uint8Array<ArrayBuffer> | string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function WasmExplorer() {
  const [files, setFiles] = useState<LoadedFiles>();
  const [analysis, setAnalysis] = useState<Analysis>();
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("sections");
  const readController = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => readController.current?.abort(), []);
  useEffect(() => {
    if (!files) return;
    const controller = new AbortController();
    setBusy(true);
    setError("");
    setAnalysis(undefined);
    analyze(files, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) {
          setAnalysis(result);
          setBusy(false);
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : String(error));
          setBusy(false);
        }
      },
    );
    return () => controller.abort();
  }, [files]);

  async function read(action: (signal: AbortSignal) => Promise<LoadedFiles>) {
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    setReading(true);
    setError("");
    try {
      const next = await action(controller.signal);
      if (!controller.signal.aborted) {
        setFiles(next);
        setView("sections");
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : String(error));
    } finally {
      if (!controller.signal.aborted) setReading(false);
    }
  }

  const disabled = busy || reading;
  const report = analysis?.report;
  const stripBytes =
    report?.sections.filter(isDiagnosticSection).reduce((sum, section) => sum + section.size, 0) ??
    0;
  const roots = analysis && {
    sections: analysis.sections,
    code: analysis.code,
    data: analysis.data,
    sources: analysis.sources,
    linker: analysis.linker,
    bss: analysis.bss,
  };
  const root = roots?.[view];
  return (
    <div class="wasm-explorer">
      <h1>WASM explorer</h1>
      <p>
        See what takes up space in an Emscripten binary, which names and debug information survived,
        and what needs rebuilding for source attribution. Files are inspected locally in a worker;
        the module is never instantiated. Maximum WASM size: 128 MiB; sidecars: 32 MiB each.
      </p>
      <div class="wasm-explorer-inputs">
        <label>
          WASM binary{" "}
          <input
            type="file"
            accept=".wasm"
            disabled={disabled}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              void read(async () => {
                if (file.size > MAX_WASM_BYTES)
                  throw new Error("WASM files must be at most 128 MiB.");
                return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
              });
              event.currentTarget.value = "";
            }}
          />
        </label>
        {examples.map((example) => (
          <button
            key={example.name}
            disabled={disabled}
            onClick={() => void read((signal) => loadExample(example, signal))}
          >
            {example.label}
          </button>
        ))}
      </div>
      <p class="muted">
        Both examples include matching function names and a linker map. The debug build also
        includes DWARF and a source map.
      </p>
      {files && (
        <fieldset disabled={disabled} class="wasm-explorer-inputs">
          <legend>Matching analysis sidecars (optional)</legend>
          {(
            [
              ["sourceMap", "WASM source map (.wasm.map)"],
              ["symbols", "Emscripten symbol map (.symbols)"],
              ["linkerMap", "LLD linker map (.txt)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} class="wasm-explorer-sidecar">
              <label>
                {label}
                <input
                  type="file"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (!file) return;
                    void read(async () => {
                      if (file.size > MAX_SIDECAR_BYTES)
                        throw new Error("Sidecars must be at most 32 MiB each.");
                      return { ...files, [key]: await file.text() };
                    });
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {files[key] !== undefined && (
                <button onClick={() => setFiles({ ...files, [key]: undefined })}>
                  Remove {label}
                </button>
              )}
            </div>
          ))}
        </fieldset>
      )}
      {disabled && <p role="status">{reading ? "Reading file…" : "Inspecting binary…"}</p>}
      {error && (
        <p role="alert" class="error">
          {error}
        </p>
      )}
      {report && analysis && files && (
        <>
          <h2>
            {files.name}: {bytesLabel(report.size)}
          </h2>
          <p>
            {report.functions.length.toLocaleString()} defined functions;{" "}
            {report.data.length.toLocaleString()} data segments; {report.imports.length} imports;{" "}
            {report.exports.length} exports. All size figures are uncompressed file bytes unless
            marked as BSS memory. Entry sizes include their framing; section sizes include headers
            and counts.
          </p>
          <ul>
            <li>
              Function name section:{" "}
              {report.functionNames.size
                ? `${report.functionNames.size.toLocaleString()} names`
                : "absent or empty"}
              . Symbol sidecar:{" "}
              {analysis.symbolCount
                ? `${analysis.symbolCount.toLocaleString()} names loaded`
                : "not loaded"}
              . Export names remain visible.
            </li>
            <li>
              Embedded DWARF:{" "}
              {report.sections.some(
                (section) => section.id === 0 && /^\.(z?debug)_/.test(section.name),
              )
                ? "present (detected, not decoded here)"
                : "absent"}
              . External DWARF reference: {report.externalDebugUrl ?? "absent"}.
            </li>
            <li>
              Source map reference: {report.sourceMapUrl ?? "absent"}.{" "}
              {analysis.sources
                ? `${bytesLabel(analysis.mappedBytes)} of function bodies mapped to source paths.`
                : "Load a matching WASM source map to see source paths."}
            </li>
            <li>
              Diagnostic metadata removable: {bytesLabel(stripBytes)}.{" "}
              {stripBytes === 0
                ? "Stripping known diagnostic sections would save zero bytes."
                : "Code and data bytes are preserved."}
            </li>
          </ul>
          {report.warnings.map((warning) => (
            <p class="error" key={warning}>
              {warning}
            </p>
          ))}
          <div class="wasm-explorer-inputs">
            <label>
              Size view{" "}
              <select value={view} onChange={(event) => setView(event.currentTarget.value as View)}>
                {(Object.keys(viewLabels) as View[]).map((key) => (
                  <option value={key} disabled={!roots?.[key]} key={key}>
                    {viewLabels[key]}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!stripBytes}
              onClick={() =>
                save(
                  stripDiagnostics(files.bytes, report),
                  `${files.name.replace(/\.wasm$/i, "")}.stripped.wasm`,
                  "application/wasm",
                )
              }
            >
              Download without diagnostic metadata
            </button>
            <button
              onClick={() =>
                save(
                  JSON.stringify(
                    {
                      file: files.name,
                      ...analysis,
                      report: {
                        ...report,
                        functionNames: Object.fromEntries(report.functionNames),
                      },
                    },
                    null,
                    2,
                  ),
                  `${files.name}.analysis.json`,
                  "application/json",
                )
              }
            >
              Download analysis JSON
            </button>
          </div>
          {stripBytes > 0 && (
            <p class="muted">
              Download removes name, producers, DWARF and debug-reference sections only. Unknown and
              linking sections remain. This also removes profiler/debugger names and invalidates
              original source-map offsets; keep the original and its sidecars.
            </p>
          )}
          {(view === "linker" || view === "bss") && (
            <p>
              Linker snapshot: these contributions precede Binaryen. Totals exclude section headers
              and unattributed linker-generated bytes, and do not reconcile to the final file.
              Symbol rows are labels on input contributions, not additional bytes. BSS is
              zero-initialized memory, not embedded payload.
            </p>
          )}
          {view === "sources" && (
            <p>
              Mapping spans are an attribution estimate from source locations, not compiler
              ownership ranges. Function prologues and explicit gaps stay unmapped; all non-body
              bytes are grouped separately.
            </p>
          )}
          {root && <SizeView key={view} root={root} />}
          {view === "data" && (
            <details>
              <summary>Preview largest data segments</summary>
              <p>
                First 512 payload bytes of each of the ten largest segments. Nonprintable bytes
                appear as ·. These are content samples, not recovered table names.
              </p>
              {[...report.data]
                .sort((a, b) => b.contentSize - a.contentSize)
                .slice(0, 10)
                .map((item) => (
                  <details key={item.index}>
                    <summary>
                      {item.name}: {bytesLabel(item.contentSize)} payload
                    </summary>
                    <pre>{dataPreview(files.bytes, item)}</pre>
                  </details>
                ))}
            </details>
          )}
          <details>
            <summary>Imports and exports</summary>
            <h3>Imports</h3>
            <ul>
              {report.imports.map((item, index) => (
                <li key={index}>
                  {item.kind}: {item.module}.{item.name}
                </li>
              ))}
            </ul>
            <h3>Exports</h3>
            <ul>
              {report.exports.map((item, index) => (
                <li key={index}>
                  {item.kind}[{item.index}]: {item.name}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      <Guidance />
    </div>
  );
}

function SizeView({ root }: { root: SizeNode }) {
  const [path, setPath] = useState<SizeNode[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SizeNode>();
  const [limit, setLimit] = useState(100);
  const current = path[path.length - 1] ?? root;
  const children = useMemo(
    () =>
      searchTree(current, query)
        .filter((node) => node.size > 0)
        .sort((a, b) => b.size - a.size),
    [current, query],
  );
  const nodes = useMemo(
    () =>
      children.length <= 120
        ? children
        : [
            ...children.slice(0, 119),
            {
              name: `Other ${children.length - 119} entries`,
              size: children.slice(119).reduce((sum, node) => sum + node.size, 0),
              children: children.slice(119),
            },
          ],
    [children],
  );
  const tiles = useMemo(() => squarify(nodes, 1000, 550), [nodes]);
  const shownBytes = children.reduce((sum, node) => sum + node.size, 0);
  function inspect(node: SizeNode) {
    setSelected(node);
    if (node.children?.length) {
      setPath([...path, node]);
      setQuery("");
      setLimit(100);
    }
  }
  return (
    <section aria-label="Size treemap">
      <p class="wasm-explorer-breadcrumbs">
        {[root, ...path].map((node, index) => (
          <button
            key={index}
            onClick={() => {
              setPath(path.slice(0, index));
              setQuery("");
              setSelected(undefined);
              setLimit(100);
            }}
          >
            {node.name}
          </button>
        ))}
      </p>
      <p>
        {bytesLabel(current.size)} in this group. Click a group to drill down. The table provides
        the same entries, including tiny rectangles.
      </p>
      <label>
        Search names and paths in this group{" "}
        <input
          type="search"
          value={query}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setLimit(100);
          }}
        />
      </label>
      {query && (
        <p>
          {bytesLabel(shownBytes)} match the filter. Treemap areas are relative to the filtered
          total.
        </p>
      )}
      <div class="wasm-explorer-treemap" aria-label="Squarified byte treemap">
        {tiles.map((tile, index) => (
          <button
            key={index}
            title={`${tile.node.name}: ${bytesLabel(tile.node.size)}`}
            aria-label={`Inspect ${tile.node.name}: ${bytesLabel(tile.node.size)}`}
            style={{
              left: `${tile.x / 10}%`,
              top: `${tile.y / 5.5}%`,
              width: `${tile.width / 10}%`,
              height: `${tile.height / 5.5}%`,
              background: `var(--wasm-color-${index % 5})`,
            }}
            onClick={() => inspect(tile.node)}
          >
            {tile.width > 65 && tile.height > 30 && (
              <>
                <span>{tile.node.name}</span>
                <small>{bytesLabel(tile.node.size)}</small>
              </>
            )}
          </button>
        ))}
      </div>
      {selected && (
        <p aria-live="polite">
          <strong>{selected.name}</strong>: {bytesLabel(selected.size)}. {selected.detail}
        </p>
      )}
      <div class="wasm-explorer-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Bytes</th>
              <th>% of group</th>
            </tr>
          </thead>
          <tbody>
            {children.slice(0, limit).map((node, index) => (
              <tr key={index}>
                <td>
                  <button onClick={() => inspect(node)}>{node.name}</button>
                </td>
                <td>{node.size.toLocaleString()}</td>
                <td>{((node.size / current.size) * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {children.length > limit && (
        <button onClick={() => setLimit(limit + 100)}>
          Show 100 more ({children.length - limit} remaining)
        </button>
      )}
      {!children.length && <p>No entries in this group.</p>}
    </section>
  );
}

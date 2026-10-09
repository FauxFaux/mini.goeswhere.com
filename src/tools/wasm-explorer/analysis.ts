import { inspectWasm, readSymbolMap, type WasmReport } from "./binary.ts";
import { readLinkerMap, type LinkerItem } from "./linker-map.ts";
import { readSourceMap, type SourceSpan } from "./source-map.ts";
import { pathTree, type SizeNode } from "./treemap.ts";

export type AnalysisInput = {
  bytes: Uint8Array;
  symbols?: string;
  sourceMap?: string;
  linkerMap?: string;
};
export type Analysis = {
  report: WasmReport;
  sections: SizeNode;
  code: SizeNode;
  data: SizeNode;
  sources?: SizeNode;
  linker?: SizeNode;
  bss?: SizeNode;
  mappedBytes: number;
  symbolCount: number;
};

function itemTree(report: WasmReport, kind: "code" | "data"): SizeNode {
  const items = kind === "code" ? report.functions : report.data;
  return {
    name: kind === "code" ? "Function entries" : "Data segment entries",
    size: items.reduce((sum, item) => sum + item.size, 0),
    children: items.map((item) => ({
      name: item.name,
      size: item.size,
      detail: `${kind === "code" ? "Function" : "Data segment"} ${item.index}; file offset 0x${item.offset.toString(16)}; ${item.contentSize.toLocaleString()} ${kind === "code" ? "body" : "payload"} bytes + ${item.size - item.contentSize} framing bytes.${kind === "data" ? ` ${item.memoryOffset === undefined ? "Passive segment" : `Memory offset ${item.memoryOffset}`}.` : ""}`,
    })),
  };
}

function sourceTree(report: WasmReport, spans: SourceSpan[]): SizeNode {
  const sizes = new Map<string, number>();
  for (const span of spans) {
    const source = span.source ?? "[unmapped code]";
    sizes.set(source, (sizes.get(source) ?? 0) + span.end - span.offset);
  }
  const codeBytes = report.functions.reduce((sum, fn) => sum + fn.contentSize, 0);
  return pathTree(
    [
      ...Array.from(sizes, ([source, size]) => ({
        path: source.split(/[\\/]/).filter(Boolean),
        size,
      })),
      { path: ["[data, metadata and framing]"], size: report.size - codeBytes },
    ],
    "Final binary by mapped source path",
  );
}

function linkerTree(items: LinkerItem[], bss: boolean): SizeNode {
  return pathTree(
    items
      .filter((item) => (item.kind === "BSS") === bss)
      .map((item) => {
        const archive = /^(.*\.a)\((.*)\)$/.exec(item.object);
        const objectPath = archive
          ? [...archive[1].split(/[\\/]/).filter(Boolean), archive[2]]
          : item.object.split(/[\\/]/).filter(Boolean);
        return {
          path: [item.kind, ...objectPath, item.name],
          size: item.size,
          detail: `${item.object}: ${item.symbols.join(", ") || item.name}; linker file offset 0x${item.offset.toString(16)}${item.address === undefined ? "" : `; memory address 0x${item.address.toString(16)}`}.`,
        };
      }),
    bss
      ? "BSS memory contributions (not file bytes)"
      : "Linker input contributions (before Binaryen)",
  );
}

export function analyzeFiles(input: AnalysisInput): Analysis {
  const report = inspectWasm(input.bytes);
  const symbols = input.symbols === undefined ? undefined : readSymbolMap(input.symbols, report);
  if (symbols)
    report.functions.forEach((fn) => {
      fn.name = symbols.get(fn.index) ?? fn.name;
    });
  const code = itemTree(report, "code");
  const data = itemTree(report, "data");
  const sections: SizeNode = {
    name: "Whole binary",
    size: report.size,
    children: [
      { name: "WASM header", size: 8 },
      ...report.sections.map((section): SizeNode => {
        const content = section.id === 10 ? code : section.id === 11 ? data : undefined;
        return {
          name: `${section.id === 0 ? "Custom: " : ""}${section.name}`,
          size: section.size,
          detail: `File offset 0x${section.offset.toString(16)}; ${section.end - section.payloadOffset} payload bytes + ${section.payloadOffset - section.offset} section header bytes.`,
          children: content
            ? [
                ...content.children!,
                { name: "Section header and count", size: section.size - content.size },
              ]
            : undefined,
        };
      }),
    ],
  };
  const spans = input.sourceMap === undefined ? undefined : readSourceMap(input.sourceMap, report);
  const linker = input.linkerMap === undefined ? undefined : readLinkerMap(input.linkerMap);
  return {
    report,
    sections,
    code,
    data,
    sources: spans && sourceTree(report, spans),
    linker: linker && linkerTree(linker, false),
    bss: linker && linkerTree(linker, true),
    mappedBytes:
      spans?.reduce((sum, span) => sum + (span.source ? span.end - span.offset : 0), 0) ?? 0,
    symbolCount: symbols?.size ?? 0,
  };
}

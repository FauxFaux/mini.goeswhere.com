import { MAX_SIDECAR_BYTES, type WasmReport } from "./binary.ts";

export type SourceSpan = { offset: number; end: number; source?: string };
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function vlq(segment: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  for (const char of segment) {
    const digit = alphabet.indexOf(char);
    if (digit < 0 || shift > 35) throw new Error("Invalid source map VLQ.");
    value += (digit & 31) * 2 ** shift;
    if (digit & 32) shift += 5;
    else {
      const magnitude = Math.floor(value / 2);
      values.push(value % 2 ? -magnitude : magnitude);
      value = 0;
      shift = 0;
    }
  }
  if (shift !== 0) throw new Error("Unterminated source map VLQ.");
  return values;
}

/** Wasm source maps use absolute binary byte offsets as generated columns on one line. */
export function readSourceMap(text: string, report: WasmReport): SourceSpan[] {
  if (text.length > MAX_SIDECAR_BYTES) throw new Error("Source map must be at most 32 MiB.");
  const map: unknown = JSON.parse(text);
  if (
    !map ||
    typeof map !== "object" ||
    !("version" in map) ||
    map.version !== 3 ||
    !("sources" in map) ||
    !Array.isArray(map.sources) ||
    map.sources.length > 100_000 ||
    !map.sources.every((source) => typeof source === "string" && source.length <= 8192) ||
    !("mappings" in map) ||
    typeof map.mappings !== "string"
  ) {
    throw new Error("Expected a version 3, non-indexed WASM source map.");
  }
  const root = "sourceRoot" in map ? map.sourceRoot : "";
  if (typeof root !== "string" || root.length > 8192) throw new Error("Invalid sourceRoot.");
  const names = "names" in map ? map.names : [];
  if (!Array.isArray(names)) throw new Error("Invalid source map names.");
  const lines = map.mappings.split(";");
  if (lines.slice(1).some((line) => line !== ""))
    throw new Error("WASM source maps must use a single generated line.");
  const mappings: { offset: number; source?: string }[] = [];
  let offset = 0;
  let sourceIndex = 0;
  let sourceLine = 0;
  let sourceColumn = 0;
  let nameIndex = 0;
  for (const segment of lines[0].split(",")) {
    if (!segment) continue;
    if (mappings.length >= 1_000_000) throw new Error("Source map has too many mappings.");
    const values = vlq(segment);
    if (![1, 4, 5].includes(values.length)) throw new Error("Invalid source map segment.");
    offset += values[0];
    if (!Number.isSafeInteger(offset) || values[0] < 0 || offset >= report.size) {
      throw new Error(
        "Source map offsets are outside this binary. Use the map from the same build.",
      );
    }
    let source: string | undefined;
    if (values.length > 1) {
      sourceIndex += values[1];
      sourceLine += values[2];
      sourceColumn += values[3];
      if (
        sourceIndex < 0 ||
        sourceIndex >= map.sources.length ||
        sourceLine < 0 ||
        sourceColumn < 0
      ) {
        throw new Error("Invalid original source location.");
      }
      if (values.length === 5) {
        nameIndex += values[4];
        if (nameIndex < 0 || nameIndex >= names.length)
          throw new Error("Invalid source map name index.");
      }
      const path = map.sources[sourceIndex] as string;
      source = root ? `${root.replace(/\/$/, "")}/${path}` : path;
    }
    mappings.push({ offset, source });
  }
  if (!mappings.length) throw new Error("Source map contains no mappings.");
  // Do not smear a preceding mapping across function boundaries or into data/metadata.
  const spans: SourceSpan[] = [];
  let cursor = 0;
  for (const fn of report.functions) {
    const start = fn.contentOffset;
    const end = start + fn.contentSize;
    while (cursor < mappings.length && mappings[cursor].offset < start) cursor++;
    let position = start;
    while (cursor < mappings.length && mappings[cursor].offset < end) {
      const mapping = mappings[cursor];
      if (mapping.offset > position) spans.push({ offset: position, end: mapping.offset });
      const next = Math.min(end, mappings[cursor + 1]?.offset ?? end);
      if (next > mapping.offset)
        spans.push({ offset: mapping.offset, end: next, source: mapping.source });
      position = next;
      cursor++;
    }
    if (position < end) spans.push({ offset: position, end });
  }
  if (!spans.some((span) => span.source))
    throw new Error("Source map does not map any function bytes in this binary.");
  return spans;
}

export const MAX_WASM_BYTES = 128 * 1024 * 1024;
export const MAX_SIDECAR_BYTES = 32 * 1024 * 1024;

export type WasmSection = {
  id: number;
  name: string;
  offset: number;
  payloadOffset: number;
  end: number;
  size: number;
};
export type WasmItem = {
  index: number;
  name: string;
  offset: number;
  contentOffset: number;
  size: number;
  contentSize: number;
  memoryOffset?: string;
};
export type WasmReport = {
  size: number;
  sections: WasmSection[];
  functions: WasmItem[];
  data: WasmItem[];
  imports: { module: string; name: string; kind: string }[];
  exports: { name: string; kind: string; index: number }[];
  functionNames: Map<number, string>;
  sourceMapUrl?: string;
  externalDebugUrl?: string;
  warnings: string[];
};

const sectionNames = [
  "Custom",
  "Type",
  "Import",
  "Function",
  "Table",
  "Memory",
  "Global",
  "Export",
  "Start",
  "Element",
  "Code",
  "Data",
  "Data count",
  "Tag",
];
const kinds = ["function", "table", "memory", "global", "tag"];
const decoder = new TextDecoder("utf-8", { fatal: true });

/** Bounded framing reader. This inventories binaries; it does not validate instructions. */
class Reader {
  pos: number;
  readonly bytes: Uint8Array;
  readonly end: number;
  constructor(bytes: Uint8Array, start = 0, end = bytes.length) {
    this.bytes = bytes;
    this.end = end;
    this.pos = start;
    if (end > bytes.length || end < start) throw new Error("Section extends beyond the file.");
  }
  byte(): number {
    if (this.pos >= this.end) throw new Error(`Unexpected end at byte ${this.pos}.`);
    return this.bytes[this.pos++];
  }
  skip(size: number) {
    if (!Number.isSafeInteger(size) || size < 0 || size > this.end - this.pos) {
      throw new Error(`Invalid length at byte ${this.pos}.`);
    }
    this.pos += size;
  }
  u32(): number {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = this.byte();
      if (i === 4 && byte > 15) throw new Error("Invalid unsigned LEB128 integer.");
      value += (byte & 127) * 2 ** (7 * i);
      if (!(byte & 128)) return value;
    }
    throw new Error("Invalid unsigned LEB128 integer.");
  }
  signed(bits: 32 | 64): bigint {
    let value = 0n;
    const count = Math.ceil(bits / 7);
    for (let i = 0; i < count; i++) {
      const byte = this.byte();
      value |= BigInt(byte & 127) << BigInt(7 * i);
      if (!(byte & 128)) {
        if (byte & 64) value -= 1n << BigInt(7 * (i + 1));
        if (value < -(1n << BigInt(bits - 1)) || value >= 1n << BigInt(bits - 1)) {
          throw new Error("Signed LEB128 integer is out of range.");
        }
        return value;
      }
    }
    throw new Error("Invalid signed LEB128 integer.");
  }
  string(): string {
    const length = this.u32();
    const start = this.pos;
    this.skip(length);
    return decoder.decode(this.bytes.subarray(start, this.pos));
  }
  count(): number {
    const count = this.u32();
    if (count > 1_000_000 || count > this.end - this.pos) {
      throw new Error("Impossible or excessive entry count.");
    }
    return count;
  }
  finish() {
    if (this.pos !== this.end) throw new Error(`Unexpected trailing bytes at ${this.pos}.`);
  }
}

function valueType(reader: Reader) {
  const type = reader.byte();
  if (type === 0x63 || type === 0x64) reader.signed(32); // typed references
}

function limits(reader: Reader) {
  const flags = reader.u32();
  if (flags & ~3)
    throw new Error("Memory64 or custom page sizes are not supported by this explorer.");
  reader.u32();
  if (flags & 1) reader.u32();
}

function initializer(reader: Reader): string {
  const opcode = reader.byte();
  let value: string;
  switch (opcode) {
    case 0x41:
      value = reader.signed(32).toString();
      break;
    case 0x42:
      value = reader.signed(64).toString();
      break;
    case 0x23:
      value = `global[${reader.u32()}]`;
      break;
    default:
      throw new Error("Unsupported data offset expression (expected const or global.get).");
  }
  if (reader.byte() !== 0x0b)
    throw new Error("Extended data offset expressions are not supported.");
  return value;
}

function readNameSection(
  reader: Reader,
  functions: Map<number, string>,
  data: Map<number, string>,
) {
  while (reader.pos < reader.end) {
    const id = reader.byte();
    const size = reader.u32();
    const sub = new Reader(reader.bytes, reader.pos, reader.pos + size);
    reader.skip(size);
    if (id !== 1 && id !== 9) continue;
    const map = id === 1 ? functions : data;
    const count = sub.count();
    for (let i = 0; i < count; i++) {
      const index = sub.u32();
      if (map.has(index)) throw new Error("Duplicate name index.");
      map.set(index, sub.string());
    }
    sub.finish();
  }
}

export function inspectWasm(bytes: Uint8Array): WasmReport {
  if (bytes.length > MAX_WASM_BYTES) throw new Error("WASM files must be at most 128 MiB.");
  const reader = new Reader(bytes);
  for (const byte of [0, 97, 115, 109, 1, 0, 0, 0]) {
    if (reader.byte() !== byte)
      throw new Error("Expected a WebAssembly version 1 binary (\\0asm).");
  }
  const report: WasmReport = {
    size: bytes.length,
    sections: [],
    functions: [],
    data: [],
    imports: [],
    exports: [],
    functionNames: new Map(),
    warnings: [],
  };
  const dataNames = new Map<number, string>();
  const seen = new Set<number>();
  let functionImports = 0;
  let declaredFunctions = 0;
  let declaredData: number | undefined;
  while (reader.pos < reader.end) {
    const offset = reader.pos;
    const id = reader.byte();
    const length = reader.u32();
    const payloadOffset = reader.pos;
    const section = new Reader(bytes, payloadOffset, payloadOffset + length);
    reader.skip(length);
    if (id !== 0 && seen.has(id)) throw new Error("Duplicate standard section.");
    seen.add(id);
    const name = id === 0 ? section.string() : (sectionNames[id] ?? `Section ${id}`);
    report.sections.push({
      id,
      name,
      offset,
      payloadOffset,
      end: reader.pos,
      size: reader.pos - offset,
    });
    if (id === 0) {
      try {
        if (name === "name") readNameSection(section, report.functionNames, dataNames);
        if (name === "sourceMappingURL") {
          report.sourceMapUrl = section.string();
          section.finish();
        }
        if (name === "external_debug_info") {
          report.externalDebugUrl = section.string();
          section.finish();
        }
      } catch (error) {
        report.warnings.push(
          `Could not read ${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else if (id === 2) {
      const count = section.count();
      for (let i = 0; i < count; i++) {
        const module = section.string();
        const name = section.string();
        const kind = section.byte();
        if (!kinds[kind]) throw new Error("Unknown import kind.");
        report.imports.push({ module, name, kind: kinds[kind] });
        switch (kind) {
          case 0:
            functionImports++;
            section.u32();
            break;
          case 1:
            valueType(section);
            limits(section);
            break;
          case 2:
            limits(section);
            break;
          case 3:
            valueType(section);
            section.byte();
            break;
          case 4:
            section.byte();
            section.u32();
            break;
        }
      }
      section.finish();
    } else if (id === 3) {
      declaredFunctions = section.count();
      for (let i = 0; i < declaredFunctions; i++) section.u32();
      section.finish();
    } else if (id === 7) {
      const count = section.count();
      for (let i = 0; i < count; i++) {
        const name = section.string();
        const kind = section.byte();
        if (!kinds[kind]) throw new Error("Unknown export kind.");
        report.exports.push({ name, kind: kinds[kind], index: section.u32() });
      }
      section.finish();
    } else if (id === 10) {
      const count = section.count();
      for (let i = 0; i < count; i++) {
        const offset = section.pos;
        const contentSize = section.u32();
        if (contentSize === 0) throw new Error("Empty function body.");
        const contentOffset = section.pos;
        section.skip(contentSize);
        report.functions.push({
          index: functionImports + i,
          name: "",
          offset,
          contentOffset,
          contentSize,
          size: section.pos - offset,
        });
      }
      section.finish();
    } else if (id === 11) {
      const count = section.count();
      for (let i = 0; i < count; i++) {
        const offset = section.pos;
        const flags = section.u32();
        if (flags > 2) throw new Error("Unknown data segment mode.");
        const memory = flags === 2 ? section.u32() : 0;
        const memoryOffset = flags === 1 ? undefined : `${initializer(section)} (memory ${memory})`;
        const contentSize = section.u32();
        const contentOffset = section.pos;
        section.skip(contentSize);
        report.data.push({
          index: i,
          name: "",
          offset,
          contentOffset,
          contentSize,
          size: section.pos - offset,
          memoryOffset,
        });
      }
      section.finish();
    } else if (id === 12) {
      declaredData = section.u32();
      section.finish();
    }
  }
  if (declaredFunctions !== report.functions.length)
    throw new Error("Function and code counts differ.");
  if (declaredData !== undefined && declaredData !== report.data.length)
    throw new Error("Data counts differ.");
  const exportNames = new Map(
    report.exports
      .filter((item) => item.kind === "function")
      .map((item) => [item.index, item.name]),
  );
  report.functions.forEach((item) => {
    item.name =
      report.functionNames.get(item.index) ?? exportNames.get(item.index) ?? `func[${item.index}]`;
  });
  report.data.forEach((item) => {
    item.name = dataNames.get(item.index) ?? `data[${item.index}]`;
  });
  return report;
}

/** Only known diagnostic custom sections; retain linking, dylink, target_features, etc. */
export function isDiagnosticSection(section: WasmSection): boolean {
  return (
    section.id === 0 &&
    (section.name === "name" ||
      section.name === "producers" ||
      section.name === "sourceMappingURL" ||
      section.name === "external_debug_info" ||
      section.name.startsWith(".debug_") ||
      section.name.startsWith(".zdebug_"))
  );
}

export function stripDiagnostics(bytes: Uint8Array, report: WasmReport): Uint8Array<ArrayBuffer> {
  const size =
    report.size -
    report.sections.filter(isDiagnosticSection).reduce((sum, item) => sum + item.size, 0);
  const output = new Uint8Array(size);
  output.set(bytes.subarray(0, 8));
  let offset = 8;
  for (const section of report.sections) {
    if (isDiagnosticSection(section)) continue;
    const piece = bytes.subarray(section.offset, section.end);
    output.set(piece, offset);
    offset += piece.length;
  }
  return output;
}

export function dataPreview(bytes: Uint8Array, item: WasmItem): string {
  return new TextDecoder()
    .decode(
      bytes.subarray(item.contentOffset, item.contentOffset + Math.min(512, item.contentSize)),
    )
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}\r\n\t]/gu, "·");
}

export function readSymbolMap(text: string, report: WasmReport): Map<number, string> {
  if (text.length > MAX_SIDECAR_BYTES) throw new Error("Symbol map is too large.");
  const names = new Map<number, string>();
  const total =
    report.functions.length + report.imports.filter((item) => item.kind === "function").length;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = /^(\d+):(.+)$/.exec(line);
    if (!match) throw new Error("Expected Emscripten index:name lines.");
    const index = Number(match[1]);
    if (!Number.isSafeInteger(index) || index >= total || names.has(index)) {
      throw new Error(
        "Symbol index is duplicate or outside this binary. Use sidecars from the same build.",
      );
    }
    names.set(index, match[2]);
  }
  if (!names.size) throw new Error("Symbol map has no names.");
  return names;
}

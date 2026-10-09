import { MAX_SIDECAR_BYTES } from "./binary.ts";

export type LinkerItem = {
  object: string;
  name: string;
  kind: "Code" | "Data" | "BSS" | "Other";
  size: number;
  offset: number;
  address?: number;
  symbols: string[];
};

/** Read LLD's Out/In/Symbol columns, counting input contributions once, not aliases. */
export function readLinkerMap(text: string): LinkerItem[] {
  if (text.length > MAX_SIDECAR_BYTES) throw new Error("Linker map must be at most 32 MiB.");
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /Addr\s+Off\s+Size\s+Out\s+In\s+Symbol/.test(line));
  if (headerIndex < 0)
    throw new Error("Expected a wasm-ld map with Addr / Off / Size / Out / In / Symbol columns.");
  const header = lines[headerIndex];
  const inputColumn = header.indexOf("In");
  const symbolColumn = header.indexOf("Symbol");
  const result: LinkerItem[] = [];
  let section = "";
  let last: LinkerItem | undefined;
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    const match = /^\s*(-|[\da-f]+)\s+([\da-f]+)\s+([\da-f]+)\s+(\S.*)$/i.exec(line);
    if (!match) throw new Error("Malformed wasm-ld map row.");
    const tail = match[4];
    const column = line.length - tail.length;
    const address = match[1] === "-" ? undefined : parseInt(match[1], 16);
    const offset = parseInt(match[2], 16);
    const size = parseInt(match[3], 16);
    if (![offset, size, address ?? 0].every(Number.isSafeInteger))
      throw new Error("Map value exceeds safe integer range.");
    if (column < inputColumn) {
      section = tail;
      last = undefined;
    } else if (column < symbolColumn) {
      const contribution = /^(.+):\((.*)\)$/.exec(tail);
      if (!contribution) {
        last = undefined;
        continue;
      }
      const kind =
        section === "CODE"
          ? "Code"
          : section.startsWith(".bss")
            ? "BSS"
            : section === "DATA" || section.startsWith(".data") || section.startsWith(".rodata")
              ? "Data"
              : "Other";
      last = {
        object: contribution[1],
        name: contribution[2],
        kind,
        size,
        offset,
        address,
        symbols: [],
      };
      result.push(last);
    } else if (last) {
      last.symbols.push(tail);
    }
  }
  if (!result.length) throw new Error("No object contributions found in the linker map.");
  return result;
}

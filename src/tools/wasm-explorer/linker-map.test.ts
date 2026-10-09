import { describe, expect, it } from "vitest";
import { analyzeFiles } from "./analysis.ts";
import { readLinkerMap } from "./linker-map.ts";
import { fixture } from "./test-fixtures.ts";

const header = "    Addr      Off     Size Out     In      Symbol";
function row(
  address: string,
  offset: string,
  size: string,
  text: string,
  column: "Out" | "In" | "Symbol",
) {
  return (
    `${address.padStart(8)} ${offset.padStart(8)} ${size.padStart(8)}`.padEnd(
      header.indexOf(column),
    ) + text
  );
}
const linkerMap = [
  header,
  row("-", "20", "15", "CODE", "Out"),
  row("-", "21", "10", "/opt/lib/libexample.a(parser.o):(parse)", "In"),
  row("-", "21", "10", "parse", "Symbol"),
  row("-", "21", "10", "parse_alias", "Symbol"),
  row("-", "40", "30", "DATA", "Out"),
  row("400", "41", "20", ".rodata", "Out"),
  row("400", "48", "20", "/opt/lib/libexample.a(tables.o):(.rodata.table)", "In"),
  row("400", "48", "20", "unit_table", "Symbol"),
  row("420", "40", "100", ".bss", "Out"),
  row("420", "0", "100", "cache.o:(.bss.cache)", "In"),
  row("420", "0", "100", "cache", "Symbol"),
].join("\n");

describe("LLD WASM map", () => {
  it("distinguishes code, named data and memory-only BSS without double-counting symbols", () => {
    const entries = readLinkerMap(linkerMap);
    expect(entries.map((entry) => [entry.kind, entry.size])).toEqual([
      ["Code", 16],
      ["Data", 32],
      ["BSS", 256],
    ]);
    expect(entries[0].symbols).toEqual(["parse", "parse_alias"]);
    expect(entries[1]).toMatchObject({
      name: ".rodata.table",
      address: 1024,
      symbols: ["unit_table"],
    });
    const analysis = analyzeFiles({ bytes: fixture(), linkerMap });
    expect(analysis.linker!.size).toBe(48);
    expect(analysis.bss!.size).toBe(256);
    expect(analysis.linker!.children!.map((node) => node.name)).toEqual(["Code", "Data"]);
  });
  it.each([
    "",
    "not a map",
    `${header}\nmalformed`,
    `${header}\n${row("-", "20", "10", "CODE", "Out")}`,
  ])("rejects unsupported maps", (text) => {
    expect(() => readLinkerMap(text)).toThrow();
  });
});

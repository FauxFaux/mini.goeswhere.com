import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeFiles } from "./analysis.ts";
import { inspectWasm, isDiagnosticSection, readSymbolMap, stripDiagnostics } from "./binary.ts";
import { custom, fixture, moduleBytes, section } from "./test-fixtures.ts";

describe("WASM inventory", () => {
  it("accounts for every byte, including mixed imports and metadata names", () => {
    const bytes = fixture();
    expect(WebAssembly.validate(bytes)).toBe(true);
    const report = inspectWasm(bytes);
    expect(8 + report.sections.reduce((sum, item) => sum + item.size, 0)).toBe(bytes.length);
    expect(report.functions[0]).toMatchObject({ index: 1, name: "named", contentSize: 2, size: 3 });
    expect(report.data[0]).toMatchObject({ name: "table-data", contentSize: 4, size: 6 });
    expect(report.imports.map((item) => item.kind)).toEqual(["memory", "function"]);
    expect(report.sourceMapUrl).toBe("fixture.wasm.map");
    expect(report.externalDebugUrl).toBe("fixture.debug.wasm");
    const analysis = analyzeFiles({ bytes });
    expect(analysis.sections.children!.reduce((sum, node) => sum + node.size, 0)).toBe(
      bytes.length,
    );
    const code = analysis.sections.children!.find((node) => node.name === "Code")!;
    expect(code.children!.reduce((sum, node) => sum + node.size, 0)).toBe(code.size);
  });

  it("uses export names when debug names are absent", () => {
    expect(inspectWasm(fixture(false)).functions[0].name).toBe("entry");
  });

  it("reads active, explicit-memory and passive data segments", () => {
    const report = inspectWasm(
      moduleBytes([
        section(11, [3, 0, 0x41, 0x7f, 0x0b, 1, 65, 2, 0, 0x41, 0, 0x0b, 1, 66, 1, 1, 67]),
      ]),
    );
    expect(report.data.map((item) => item.memoryOffset)).toEqual([
      "-1 (memory 0)",
      "0 (memory 0)",
      undefined,
    ]);
    expect(report.data.map((item) => item.contentSize)).toEqual([1, 1, 1]);
  });

  it("strips only diagnostic custom sections and keeps code, data and unknown metadata byte-identical", () => {
    const original = fixture();
    const report = inspectWasm(original);
    const stripped = stripDiagnostics(original, report);
    expect(WebAssembly.validate(stripped)).toBe(true);
    const after = inspectWasm(stripped);
    expect(after.sections.filter(isDiagnosticSection)).toEqual([]);
    const retained = report.sections.filter((item) => !isDiagnosticSection(item));
    expect(after.sections.map((item) => item.name)).toEqual(retained.map((item) => item.name));
    after.sections.forEach((item, index) => {
      expect(Array.from(stripped.subarray(item.offset, item.end))).toEqual(
        Array.from(original.subarray(retained[index].offset, retained[index].end)),
      );
    });
    expect(Array.from(stripDiagnostics(fixture(false), inspectWasm(fixture(false))))).toEqual(
      Array.from(fixture(false)),
    );
  });

  it.each([
    [new Uint8Array([0, 97]), /end/],
    [new Uint8Array(8), /version 1/],
    [moduleBytes([[10, 127, 0]]), /beyond/],
    [moduleBytes([[1, 128, 128, 128, 128, 16]]), /LEB128/],
    [moduleBytes([section(3, [1, 0])]), /counts differ/],
    [moduleBytes([section(11, [255, 255, 255, 255, 15])]), /count/],
    [moduleBytes([section(12, [1])]), /Data counts/],
    [moduleBytes([section(1, [0]), section(1, [0])]), /Duplicate/],
    [moduleBytes([section(11, [1, 0, 0x41, 0, 0x41, 0, 0x6a, 0x0b, 0])]), /Extended/],
  ])(
    "rejects truncated, oversized and unsupported framing without running code",
    (bytes, message) => {
      expect(() => inspectWasm(bytes)).toThrow(message);
    },
  );

  it("keeps an inventory when optional metadata is corrupt", () => {
    const report = inspectWasm(moduleBytes([custom("sourceMappingURL", [127])]));
    expect(report.warnings[0]).toContain("sourceMappingURL");
  });

  it("parses colon-containing demangled names and checks symbol indices", () => {
    const report = inspectWasm(fixture());
    expect(readSymbolMap("0:import\n1:Calculator::parse(int)\n", report).get(1)).toBe(
      "Calculator::parse(int)",
    );
    for (const invalid of ["1:first\n1:second", "2:outside", "broken", ""])
      expect(() => readSymbolMap(invalid, report)).toThrow();
  });

  it("inventories the shipped multi-megabyte Emscripten binary", () => {
    const bytes = new Uint8Array(
      readFileSync(new URL("../../assets/qalculate.wasm", import.meta.url)),
    );
    const report = inspectWasm(bytes);
    expect(report.functions.length).toBeGreaterThan(4000);
    expect(report.data.length).toBeGreaterThan(500);
    expect(report.sections.filter((item) => item.id === 0)).toEqual([]);
    expect(report.size).toBe(bytes.length);
    expect(Buffer.compare(bytes, stripDiagnostics(bytes, report))).toBe(0);
  });
});

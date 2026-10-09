import { describe, expect, it } from "vitest";
import { analyzeFiles } from "./analysis.ts";
import { inspectWasm } from "./binary.ts";
import { fixture, mapping } from "./test-fixtures.ts";
import { readSourceMap } from "./source-map.ts";

const report = inspectWasm(fixture());
const start = report.functions[0].contentOffset;
const map = (mappings: string, sources = ["/deps/library.c"]) =>
  JSON.stringify({ version: 3, sources, names: [], mappings });

describe("WASM source attribution", () => {
  it("uses absolute offsets, leaves prologues unmapped and preserves the whole-binary total", () => {
    const text = map(mapping([start + 1, 0, 5, 0]));
    expect(readSourceMap(text, report)).toEqual([
      { offset: start, end: start + 1 },
      { offset: start + 1, end: start + 2, source: "/deps/library.c" },
    ]);
    const analysis = analyzeFiles({ bytes: fixture(), sourceMap: text });
    expect(analysis.mappedBytes).toBe(1);
    expect(analysis.sources!.size).toBe(report.size);
  });

  it("respects unmapped markers and never spills a mapping into data", () => {
    const text = map(
      [
        mapping([start, 0, 0, 0]),
        mapping([1]),
        mapping([report.data[0].contentOffset - start - 1, 0, 0, 0]),
      ].join(","),
    );
    expect(readSourceMap(text, report)).toEqual([
      { offset: start, end: start + 1, source: "/deps/library.c" },
      { offset: start + 1, end: start + 2 },
    ]);
  });

  it("uses the last mapping at duplicate offsets", () => {
    expect(
      readSourceMap(
        map([mapping([start, 0, 0, 0]), mapping([0, 1, 0, 0])].join(","), ["a.c", "b.c"]),
        report,
      )[0].source,
    ).toBe("b.c");
  });

  it.each([
    "null",
    "{}",
    JSON.stringify({ version: 3, sections: [] }),
    map(mapping([report.size, 0, 0, 0])),
    map(mapping([start, -1, 0, 0])),
    map(mapping([start, 0, -1, 0])),
    map("!"),
    map("g"),
    map(`${mapping([start, 0, 0, 0])};AAAA`),
    map(mapping([start, 0, 0, 0, 1])),
    map(mapping([1, 0, 0, 0])),
  ])("rejects malformed or incompatible maps: %s", (text) =>
    expect(() => readSourceMap(text, report)).toThrow(),
  );
});

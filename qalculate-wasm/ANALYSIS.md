# Understanding the WASM binary

The `#/wasm-explorer` mini app inventories a local WASM file in a worker without
instantiating it. It shows a squarified, drillable treemap and searchable size
tables for sections, function entries, data segments, source paths, and linker
library/object contributions. WASM input is limited to 128 MiB and each sidecar
to 32 MiB. It detects DWARF but does not decode it; use LLVM or a debugger for that.
It supports wasm32 Emscripten framing, including passive data segments. It rejects
memory64 imports and extended data offset expressions with an explanatory error.
This is an inventory reader, not a full instruction validator.

The two example buttons fetch their assets only when clicked. The production
example loads `src/assets/qalculate.wasm` with its matching `.symbols` and linker
map from `src/assets/qalculate-analysis/production/`. The debug example loads
the binary and all three sidecars from `src/assets/qalculate-analysis/debug/`.
The debug directory preserves the original filenames for local inspection.
Both sets are emitted as hashed Vite assets for deployment; the explorer loads
sidecars using their imported URLs rather than the embedded `sourceMappingURL`.
The calculator continues to use the production binary.

To refresh the committed examples after rebuilding:

```sh
npm run analyze:qalculate-wasm:symbols
npm run analyze:qalculate-wasm
# Check that production sidecars label the current shipped binary.
cmp src/assets/qalculate.wasm qalculate-wasm/analysis-symbols/qalculate.wasm
cp qalculate-wasm/analysis-symbols/qalculate.mjs.symbols \
   qalculate-wasm/analysis-symbols/qalculate.linker-map.txt \
   src/assets/qalculate-analysis/production/
cp qalculate-wasm/analysis/qalculate.wasm \
   qalculate-wasm/analysis/qalculate.wasm.map \
   qalculate-wasm/analysis/qalculate.mjs.symbols \
   qalculate-wasm/analysis/qalculate.linker-map.txt \
   src/assets/qalculate-analysis/debug/
```

## Findings for the committed binary

Verified on 2026-10-09, SHA-256:
`68a4d6cd0dfe6dc227f95930912041777ddc8a232b659e9c50e06261d3c5561c`.

| Contribution               | File bytes |
| -------------------------- | ---------: |
| Function entries (4,407)   |  3,308,843 |
| Data segment entries (581) |  1,172,447 |
| Headers and other sections |     12,854 |
| Total                      |  4,494,144 |

Entry sizes include framing. The file has no custom sections: no `name`, embedded
DWARF, `external_debug_info`, or `sourceMappingURL`. No source-map sidecar is
committed. Stripping its diagnostic metadata saves **zero bytes**.

The symbols-only analysis build produced **the same SHA-256 and identical bytes**,
so its `.symbols` sidecar labels the actual shipped functions. The largest are:

| Function                       | Entry bytes |
| ------------------------------ | ----------: |
| `Calculator::loadDefinitions`  |     182,782 |
| `main`                         |     162,726 |
| `MathStructure::isolate_x_sub` |     140,370 |
| `Calculator::parse`            |      64,235 |
| `Number::print`                |      53,942 |

The linker map also identifies data tables: `PRIMES_L` contributes 400,032 bytes
and `PRIME_M` 80,000 bytes from `libqalculate.a(BuiltinFunctions-number.o)`.
There is a 507,797-byte linker-generated `.rodata` contribution whose original
per-string ownership is not recorded. Other named data includes `__gmpn_bases`,
`__pow_log_data`, and libxml2's `html40EntitiesTable`. These are **linker input
contributions**, not final per-symbol size claims: Binaryen can rearrange data.

| Archive                 | Linker code contribution bytes |
| ----------------------- | -----------------------------: |
| libqalculate.a          |                      2,978,645 |
| libxml2.a               |                        290,935 |
| libgmp.a                |                        266,667 |
| libmpfr.a               |                        239,959 |
| libc++-debug-noexcept.a |                        129,406 |

Do not sum this table as a final-file breakdown. The complete linker code
inventory is 3,981,621 bytes before Binaryen, versus 3,308,843 final function-entry
bytes. `BSS` rows represent memory, not stored payload. Symbol rows label the
enclosing input contribution and must not be counted twice.

## Reproducible analysis workflows

```sh
# Names and library/object/data-symbol inventory, normal optimization pipeline.
npm run analyze:qalculate-wasm:symbols
# Source paths: rebuild all four archives and the binding with -O2 -g.
npm run analyze:qalculate-wasm
```

Outputs are ignored directories `qalculate-wasm/analysis-symbols/` and
`qalculate-wasm/analysis/`. Load their `qalculate.wasm`, `qalculate.mjs.symbols`,
`qalculate.linker-map.txt`, and, for source attribution, `qalculate.wasm.map`.
Keep each binary and its sidecars together. Verify binary identity before
applying names from a rebuild to an older artifact. These builds do not update
`src/assets/`.

For separate DWARF:

```sh
docker build --target analysis \
  --build-arg WASM_DEBUG_FLAGS=-g \
  --build-arg WASM_ANALYSIS=dwarf \
  --output type=local,dest=qalculate-wasm/analysis-dwarf \
  qalculate-wasm
```

`-g` must reach every object whose sources you want; adding it only at the final
link cannot recover source information from non-debug archives. Function names
and linker maps can be obtained by relinking existing non-debug archives. The
Docker arguments are independent: pass both `WASM_DEBUG_FLAGS=-g` and the desired
source/DWARF mode. SDK system libraries can have different debug coverage.

The source-map rebuild emitted an Emscripten warning about limited Binaryen
optimizations and produced 7,146 functions / 3,501,889 function-entry bytes.
Its data entries stayed identical in size. The 28,857,744-byte analysis file
retains DWARF and function names as well as a source-map reference; most of its
size is diagnostic metadata. Of 3,491,647 body bytes, 3,370,527 map to source
paths. The rest stay explicitly unmapped. Its source map describes **its own
offsets**, not the production binary's offsets. Optimization-preserving source
attribution for production cannot be promised by simply adding a debug flag.

The explorer assigns source-map locations until the next mapping, bounded by
each function body. It leaves prologues, unmapped markers and non-code bytes
separate. This is location-based attribution rather than compiler ownership.
Inlining and deduplication complicate per-library totals. The linker map is
presented as a distinct pre-Binaryen snapshot and is never overlaid on final
offsets.

## External tools

- [WABT](https://github.com/WebAssembly/wabt): `wasm-objdump -h/-x/-d`, `wasm2wat`,
  `wasm-decompile`, and `wasm-strip`. WABT strip removes **all custom sections**;
  the explorer only removes known diagnostic sections and retains unknown,
  linking and feature sections.
- [wasm-tools](https://github.com/bytecodealliance/wasm-tools): `dump`, `print`,
  `validate`, and `strip` subcommands.
- [Bloaty](https://github.com/google/bloaty): experimental WASM support, including
  names/data segments and source-map compile-unit attribution. Try
  `bloaty file.wasm -d compileunits --debug-file=file.wasm.map`. Its
  [WASM backend](https://github.com/google/bloaty/blob/main/src/webassembly.cc)
  requires a source map for compile units; native ELF capabilities differ.
- [Ghidra WASM plugin](https://github.com/nneonneo/ghidra-wasm-plugin): install a
  release matching Ghidra, import the WASM, and analyze for disassembly,
  decompilation and cross-references. Useful even without debug info, with
  feature limitations and potentially slow analysis. Original names cannot be
  recovered from a stripped binary without other evidence.
- [LLVM dwarfdump](https://llvm.org/docs/CommandGuide/llvm-dwarfdump.html):
  `llvm-dwarfdump --debug-info --debug-line file.debug.wasm`.
  `llvm-nm --print-size --size-sort --demangle library.a` explains input symbols,
  including those discarded at link. `llvm-readobj --sections --symbols` reads
  object/linking symbols when present.
- [Emscripten debugging](https://emscripten.org/docs/porting/Debugging.html):
  `emsymbolizer` for address resolution and Chrome's C/C++ DWARF extension.
- [Twiggy](https://github.com/AlexEne/twiggy): optional call-graph/retained-size
  experiment. Its upstream is archived; performance on multi-megabyte modern
  Emscripten modules has not been verified here. The explorer does not use it.

Build/format references: [Emscripten debug flags](https://emscripten.org/docs/tools_reference/emcc.html),
[WASM debugging conventions](https://github.com/WebAssembly/tool-conventions/blob/main/Debugging.md),
and [LLD's WASM map fixture](https://github.com/llvm/llvm-project/blob/main/lld/test/wasm/map-file.s).

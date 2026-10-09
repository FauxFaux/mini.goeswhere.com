export function Guidance() {
  return (
    <>
      <h2>What the metadata can tell you</h2>
      <div class="wasm-explorer-scroll">
        <table>
          <thead>
            <tr>
              <th>Evidence</th>
              <th>What it explains</th>
              <th>What to rebuild</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Section and body framing</td>
              <td>Exact uncompressed bytes per section, function entry and data segment.</td>
              <td>Nothing. Available even in stripped binaries.</td>
            </tr>
            <tr>
              <td>Exports / name section / .symbols</td>
              <td>
                Function indices and names. Data segment names if supplied in the name section.
              </td>
              <td>
                Relink with --profiling-funcs or --emit-symbol-map. Function names do not require
                recompiling archives.
              </td>
            </tr>
            <tr>
              <td>.wasm.map</td>
              <td>
                Final code byte offsets mapped to source paths. This explorer assigns each mapping
                up to the next mapping within its function; gaps stay unmapped.
              </td>
              <td>
                Compile every relevant C/C++ object and static library with -O2 -g; link with -O2
                -gsource-map. A final-link flag cannot recover missing source information.
              </td>
            </tr>
            <tr>
              <td>.debug_* / external_debug_info</td>
              <td>
                DWARF can describe source lines, types, variables, and inlined ranges. This explorer
                detects it; use the tools below to decode it.
              </td>
              <td>
                Compile all relevant objects with -O2 -g, then link with -g or -gseparate-dwarf.
                Keep the matching sidecar.
              </td>
            </tr>
            <tr>
              <td>wasm-ld linker map</td>
              <td>
                Archive, object, code symbols and named data contributions; BSS memory is shown
                separately.
              </td>
              <td>
                Relink with -Wl,-Map=output.linker-map.txt. This describes the linker output before
                Binaryen; its offsets and sizes may differ from the final binary.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Source maps describe code locations, not the names of C arrays or embedded data tables. A
        WASM table section contains function references; C arrays and strings usually live in
        linear-memory data segments. A global section stores WASM globals, not all C global
        variables. Strings in a segment are clues to its contents, not proof of library ownership.
      </p>
      <p>
        Inlining, merging and deduplication make library ownership ambiguous. Source paths come from
        the compiler’s mappings; no library is inferred from a function name. Sidecars must come
        from the same build: range checks catch some mismatches, but these formats do not provide a
        reliable cryptographic identity check.
      </p>
      <h2>Rebuild this repository for analysis</h2>
      <p>Start with function names and the linker’s code/data inventory:</p>
      <pre>npm run analyze:qalculate-wasm:symbols</pre>
      <p>
        This exports to <code>qalculate-wasm/analysis-symbols/</code>. Load its binary,{" "}
        <code>qalculate.mjs.symbols</code> and <code>qalculate.linker-map.txt</code>. It keeps the
        normal optimization pipeline. The verified rebuild of this repository produced a
        byte-identical binary to the shipped 4,494,144-byte file, so its function names can also
        label that exact shipped file. Recheck identity after future rebuilds.
      </p>
      <p>For source paths, rebuild all dependencies with debug information:</p>
      <pre>npm run analyze:qalculate-wasm</pre>
      <p>
        This exports an optimized analysis build to <code>qalculate-wasm/analysis/</code>. Load its{" "}
        <code>qalculate.wasm</code>, <code>qalculate.wasm.map</code>,{" "}
        <code>qalculate.mjs.symbols</code>, and <code>qalculate.linker-map.txt</code> here. GMP,
        MPFR, libxml2, libqalculate and the bindings are all compiled with <code>-O2 -g</code>. The
        normal build stays separate. Emscripten system-library source coverage can still depend on
        the SDK’s cached libraries.
      </p>
      <p>For DWARF instead of a source map:</p>
      <pre>
        {
          "docker build --target analysis \\\n  --build-arg WASM_DEBUG_FLAGS=-g \\\n  --build-arg WASM_ANALYSIS=dwarf \\\n  --output type=local,dest=qalculate-wasm/analysis-dwarf \\\n  qalculate-wasm"
        }
      </pre>
      <p>
        In the verified source-map build, Emscripten warned that DWARF limits Binaryen
        optimizations. Function-entry bytes increased from 3,308,843 to 3,501,889, while data-entry
        bytes stayed at 1,172,447. Source maps describe that analysis binary; they cannot label
        production offsets. The exported file also retains embedded DWARF. Keep the original binary
        alongside its matching artifacts.
      </p>
      <h2>Tools to try</h2>
      <p>
        <a href="https://github.com/WebAssembly/wabt">WABT</a> provides section inspection,
        instruction disassembly, a C-like decompiler and stripping. These work without original
        source names.
      </p>
      <pre>
        {
          "wasm-objdump -h file.wasm\nwasm-objdump -x file.wasm > details.txt\nwasm-objdump -d file.wasm > disassembly.txt\nwasm-decompile file.wasm -o file.dcmp\nwasm2wat file.wasm -o file.wat\n# wasm-strip removes ALL custom sections; retain the original.\nwasm-strip file.wasm -o stripped.wasm"
        }
      </pre>
      <p>
        <a href="https://github.com/bytecodealliance/wasm-tools">wasm-tools</a> is another parser,
        validator and text printer: <code>wasm-tools dump file.wasm</code> and{" "}
        <code>wasm-tools print file.wasm</code>. Dumps and disassembly can be much larger than the
        binary.
      </p>
      <p>
        <a href="https://github.com/google/bloaty">Bloaty</a> has experimental WASM support. Its
        WASM backend uses name sections for function/data segment symbols and a source map for
        compile-unit attribution. This is a candidate for source-size reports, with format
        limitations; native ELF capabilities do not all carry over.
      </p>
      <pre>
        {
          "bloaty file.wasm -d sections\nbloaty file.wasm -d symbols\nbloaty file.wasm -d compileunits --debug-file=file.wasm.map"
        }
      </pre>
      <p>
        <a href="https://github.com/nneonneo/ghidra-wasm-plugin">Ghidra WASM plugin</a> supports
        disassembly, decompilation, call cross-references and recovery of Emscripten’s C stack.
        Install a release matching your Ghidra version, import the WASM and run analysis. It can
        work on a stripped binary, but cannot recreate original names or source paths. Expect
        analysis cost and proposal-specific limitations.
      </p>
      <p>
        <a href="https://llvm.org/docs/CommandGuide/llvm-dwarfdump.html">LLVM tools</a> can inspect
        DWARF and object/archive symbols. The pinned Emscripten image includes LLVM tools.
      </p>
      <pre>
        {
          "llvm-dwarfdump --debug-info --debug-line file.debug.wasm\nllvm-nm --print-size --size-sort --demangle library.a\nllvm-readobj --sections --symbols file.wasm"
        }
      </pre>
      <p>
        Archive symbol sizes describe input objects, including code the linker may discard. They are
        not final binary size totals.{" "}
        <a href="https://emscripten.org/docs/porting/Debugging.html">Emscripten’s emsymbolizer</a>{" "}
        resolves addresses using matching DWARF, source maps or symbol maps; Chrome’s C/C++ DWARF
        extension is useful for interactive source debugging.
      </p>
      <p>
        <a href="https://github.com/AlexEne/twiggy">Twiggy</a> is an optional
        call-graph/retained-size experiment: <code>twiggy top file.wasm</code>,{" "}
        <code>twiggy paths file.wasm</code>, <code>twiggy dominators file.wasm</code>. Its upstream
        repository is archived. Performance and feature support on large modern Emscripten modules
        are unverified here; this explorer does not depend on it. Retained size is a different
        question from the byte inventory above.
      </p>
      <p>
        Format and build references:{" "}
        <a href="https://github.com/WebAssembly/tool-conventions/blob/main/Debugging.md">
          WASM debug conventions
        </a>
        , <a href="https://emscripten.org/docs/tools_reference/emcc.html">Emscripten debug flags</a>
        ,{" "}
        <a href="https://github.com/llvm/llvm-project/blob/main/lld/test/wasm/map-file.s">
          LLD map format
        </a>
        ,{" "}
        <a href="https://github.com/google/bloaty/blob/main/src/webassembly.cc">
          Bloaty WASM backend
        </a>
        .
      </p>
    </>
  );
}

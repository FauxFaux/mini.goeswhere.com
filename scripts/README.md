Regenerate the calculator unit catalogue with `npm run ingest:units`. Python 3's
standard library reads `data/units.xml.in` from the bundled corresponding sources
in `src/assets/qalculate-sources.tar.gz`, keeping the catalogue aligned with WASM.
Run this again after rebuilding or upgrading libqalculate.

To ingest a separate checkout instead:

```sh
npm run ingest:units -- ~/clone/libqalculate/data/units.xml.in
```

The generated `src/tools/calculator/units.json` includes a SHA-256 of the input.
The script preserves nested categories, all English names (with name flags
removed), descriptions, alias relations, and composite powers and decimal/binary
prefix factors. Hidden definitions are included because they can still be used in
expressions. The base-unit column refers to the immediate definition, not an
expansion into SI units. Nonlinear relations show `x` as the input value.

Run `python3 -m unittest discover -s scripts -p '*_test.py'` to test ingestion.
Run `npm run format` after regeneration.

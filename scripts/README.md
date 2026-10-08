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

Regenerate the city catalogue with `python3 scripts/ingest-cities.py`. This reads
`datae/worldcities.csv` and writes compact `src/assets/cities.json`. Both paths
default relative to the repository; override with a positional input path and
`--output PATH` if needed.

Each row is `[city, iso2, admin_name, latitude, longitude]`, with coordinates
rounded to three decimal places. Per country, selection keeps the largest ten
cities, plus cities with at least 50,000 people within the largest 150, and all
primary capitals regardless of rank or population. Missing populations rank as
zero; population ties retain CSV order. Countries appear in CSV encounter order,
with selected cities ordered by descending population within each country.
The generated JSON is excluded from formatting to preserve its compact layout.

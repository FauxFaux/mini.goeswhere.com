#!/usr/bin/env python3
"""Build the compact location-picker catalogue using only Python's standard library.

Rows are [city, iso2, admin_name, latitude, longitude]. Within each country,
keep the ten largest cities, plus cities of at least 50,000 people within the
largest 150. Always include primary capitals. Missing populations rank as zero;
ties retain CSV order. Coordinates are rounded to three decimal places.
"""

import argparse
import csv
import gzip
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def select_cities(rows):
    countries = defaultdict(list)
    for row in rows:
        countries[row["iso2"]].append(row)
    selected = []
    for cities in countries.values():
        cities.sort(key=lambda row: float(row["population"] or 0), reverse=True)
        for rank, row in enumerate(cities):
            population = float(row["population"] or 0)
            if rank < 10 or (population >= 50_000 and rank < 150) or row["capital"] == "primary":
                selected.append([
                    row["city"], row["iso2"], row["admin_name"],
                    round(float(row["lat"]), 3), round(float(row["lng"]), 3),
                ])
    return selected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", type=Path, default=ROOT / "datae/worldcities.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "src/assets/cities.json")
    args = parser.parse_args()
    with args.input.open(encoding="utf-8-sig", newline="") as source:
        cities = select_cities(csv.DictReader(source))
    if not cities:
        raise ValueError("Expected a nonempty city catalogue")
    data = (json.dumps(cities, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")
    args.output.write_bytes(data)
    print(f"Wrote {len(cities):,} cities to {args.output}: "
          f"{len(data) / 1024:.1f} KiB JSON, {len(gzip.compress(data, mtime=0)) / 1024:.1f} KiB gzip")


if __name__ == "__main__":
    main()

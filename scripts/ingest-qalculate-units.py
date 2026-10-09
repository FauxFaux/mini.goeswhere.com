#!/usr/bin/env python3
"""Convert libqalculate's English unit definitions to the calculator catalogue.

Read definitions from a libqalculate checkout matching the WASM engine release.
Requires only Python 3.
"""

import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]


def text(element, tag, default=""):
    return element.findtext(tag, default).strip()


def title(element):
    # Gettext context markers are not part of the displayed English title.
    return text(element, "title").rsplit("!", 1)[-1]


def power(unit, exponent):
    return unit if exponent == "1" else f"({unit})^{exponent}"


def ingest(xml):
    root = ET.fromstring(xml)
    if root.tag != "QALCULATE":
        raise ValueError("Expected a QALCULATE definitions document")
    rows = []

    def visit(element, category):
        for child in element:
            if child.tag == "category":
                visit(child, [*category, title(child)])
            elif child.tag == "unit" and "type" in child.attrib:
                names = list(dict.fromkeys(
                    name.strip().split(":", 1)[-1]
                    for name in text(child, "names").split(",") if name.strip()
                ))
                references = [
                    name.split(":", 1)[-1] for name in text(child, "names").split(",")
                    if ":" in name and "r" in name.split(":", 1)[0]
                ]
                if not names or not title(child):
                    raise ValueError("Unit is missing its title or names")
                kind = child.attrib["type"]
                bases = []
                if kind == "base":
                    definition = "Base unit"
                elif kind == "alias":
                    base = child.find("base")
                    if base is None or not text(base, "unit"):
                        raise ValueError(f"Missing base for {title(child)}")
                    bases = [text(base, "unit")]
                    factor = text(base, "relation", "1").replace("\\x", "x")
                    unit = power(bases[0], text(base, "exponent", "1"))
                    definition = unit if factor == "1" else f"({factor}) × {unit}"
                    if "\\x" in text(base, "relation"):
                        definition = f"x → {definition}"
                elif kind == "composite":
                    parts = []
                    for part in child.findall("part"):
                        unit = text(part, "unit")
                        if not unit:
                            raise ValueError(f"Missing component for {title(child)}")
                        bases.append(unit)
                        prefix = part.find("prefix")
                        if prefix is not None and prefix.text not in (None, "0"):
                            radix = "2" if prefix.get("type") == "binary" else "10"
                            unit = f"{radix}^{prefix.text.strip()} × {unit}"
                        parts.append(power(unit, text(part, "exponent", "1")))
                    if not parts:
                        raise ValueError(f"Missing components for {title(child)}")
                    definition = " × ".join(parts)
                else:
                    raise ValueError(f"Unknown unit type: {kind}")
                rows.append({
                    "id": references[0].strip() if references else names[0],
                    "title": title(child),
                    "names": names,
                    "category": " / ".join(category) or "Other",
                    "baseUnit": " × ".join(dict.fromkeys(bases)),
                    "definition": definition,
                    "description": text(child, "description"),
                })

    visit(root, [])
    if not rows or len({row["id"] for row in rows}) != len(rows):
        raise ValueError("Expected nonempty units with unique reference names")
    # Include reference titles in base-unit searches as well as their symbols.
    titles = {name: row["title"] for row in rows for name in row["names"]}
    for row in rows:
        row["baseUnit"] = " × ".join(
            f"{name} ({titles[name]})" if name in titles else name
            for name in row["baseUnit"].split(" × ") if name
        )
    return {
        "source": "libqalculate/data/units.xml.in",
        "sha256": hashlib.sha256(xml).hexdigest(),
        "units": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="units.xml.in path from a matching libqalculate checkout")
    parser.add_argument("--output", type=Path, default=ROOT / "src/tools/calculator/units.json")
    args = parser.parse_args()
    catalogue = ingest(args.input.read_bytes())
    args.output.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(catalogue['units'])} units to {args.output}")


if __name__ == "__main__":
    main()

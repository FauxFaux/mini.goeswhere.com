import importlib.util
from pathlib import Path
import unittest


spec = importlib.util.spec_from_file_location(
    "ingest", Path(__file__).with_name("ingest-qalculate-units.py")
)
ingest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingest)


class IngestionTests(unittest.TestCase):
    def test_categories_names_and_definitions(self):
        xml = b"""<QALCULATE><category><title>!units!Information</title>
        <unit type="base"><title>Bit &amp; digit</title><names>ar:bit,p:bits,bit</names></unit>
        <category><title>Storage</title><unit type="composite">
        <title>Kibibit squared</title><names>r:kibit_squared</names>
        <part><unit>bit</unit><prefix type="binary">10</prefix><exponent>2</exponent></part>
        </unit></category>
        <unit type="alias"><title>Nonlinear</title><names>r:nonlinear</names><base>
        <unit>bit</unit><relation>\\x + 1</relation><exponent>-1</exponent>
        </base></unit></category></QALCULATE>"""
        rows = ingest.ingest(xml)["units"]
        self.assertEqual(rows[0]["title"], "Bit & digit")
        self.assertEqual(rows[0]["names"], ["bit", "bits"])
        self.assertEqual(rows[1]["category"], "Information / Storage")
        self.assertEqual(rows[1]["definition"], "(2^10 × bit)^2")
        self.assertEqual(rows[1]["baseUnit"], "bit (Bit & digit)")
        self.assertEqual(rows[2]["definition"], "x → (x + 1) × (bit)^-1")

    def test_rejects_missing_and_duplicate_definitions(self):
        for xml in [
            b"<OTHER/>",
            b"<QALCULATE/>",
            b'<QALCULATE><unit type="alias"><title>Bad</title><names>r:bad</names></unit></QALCULATE>',
            b'<QALCULATE><unit type="base"><title>One</title><names>r:x</names></unit>'
            b'<unit type="base"><title>Two</title><names>r:x</names></unit></QALCULATE>',
        ]:
            with self.subTest(xml=xml), self.assertRaises(ValueError):
                ingest.ingest(xml)


if __name__ == "__main__":
    unittest.main()

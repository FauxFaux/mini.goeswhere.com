import importlib.util
from pathlib import Path
import unittest


spec = importlib.util.spec_from_file_location("ingest_cities", Path(__file__).with_name("ingest-cities.py"))
ingest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingest)


def city(name, population="", country="AA", capital=""):
    return dict(city=name, population=population, iso2=country, capital=capital,
                admin_name="Region", lat="1.23456", lng="-2.34567")


class CitySelectionTests(unittest.TestCase):
    def test_population_threshold_and_cap_with_capital_exception(self):
        rows = [city(str(i), str(200_000 - i)) for i in range(160)]
        rows += [city("below threshold", "49999"), city("capital", "", capital="primary")]
        selected = ingest.select_cities(rows)
        self.assertEqual([row[0] for row in selected], [str(i) for i in range(150)] + ["capital"])

    def test_minimum_country_coverage_threshold_and_rounding(self):
        rows = [city(str(i), "0") for i in range(12)]
        rows += [city("threshold", "50000.0"), city("small country", country="BB")]
        selected = ingest.select_cities(rows)
        self.assertEqual([row[0] for row in selected], ["threshold"] + [str(i) for i in range(9)] + ["small country"])
        self.assertEqual(selected[-1], ["small country", "BB", "Region", 1.235, -2.346])


if __name__ == "__main__":
    unittest.main()

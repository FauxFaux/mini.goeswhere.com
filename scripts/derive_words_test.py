import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("derive_words", Path(__file__).with_name("derive-words.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DeriveWordsTest(unittest.TestCase):
    def test_frequency_cutoff_duplicates_and_aspell_tail(self):
        news = "1\t!\t2\n101\tthe\t100\n102\tand\t80\n103\tThe\t90\n104\ttie\t80\n"
        self.assertEqual(
            module.derive_words(news, "and\nrare\nThe\nrare\n\n", limit=3),
            ["the", "and", "rare"],
        )

    def test_frequency_ties_keep_source_order(self):
        self.assertEqual(module.derive_words("1\tb\t5\n2\ta\t5\n", ""), ["b", "a"])

    def test_rejects_truncated_mojibake_but_keeps_valid_accents(self):
        news = "1\twouldnâ\t100\n2\titâ\t90\n3\tChâteau\t80\n4\twouldn’t\t70\n"
        self.assertEqual(module.derive_words(news, "donâ\npâté\n"), ["château", "wouldn't", "pâté"])

    def test_filters_both_sources_without_backfilling_news_cutoff(self):
        news = "1\tit,”\t100\n2\ttwo\t90\n3\tbackfill\t1\n"
        aspell = "Two\nTWO\n2nd\ntwo words\ncat's\ncat’s\n!\nword.\n'word\nword-\nword--word\nwell-being\ncan't\n"
        self.assertEqual(module.derive_words(news, aspell, limit=2), ["two", "well-being", "can't"])

    def test_case_accent_and_apostrophe_collisions_keep_first_spelling(self):
        news = "1\tCAFÉ\t100\n2\tcafe\t90\n3\tcan’t\t80\n"
        self.assertEqual(module.derive_words(news, "Café\ncafe\u0301\ncan't\n"), ["café", "can't"])

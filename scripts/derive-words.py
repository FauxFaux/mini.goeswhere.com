"""Merge the 100,000 most frequent news tokens with the Aspell dictionary."""

from pathlib import Path
import unicodedata

ROOT = Path(__file__).resolve().parent.parent
NEWS = ROOT / "datae/eng_news_2025_300K/eng_news_2025_300K-words.txt"
ASPELL = ROOT / "src/assets/aspell-wbritish.txt"
OUTPUT = ROOT / "src/assets/derived-words.txt"


def word_key(word: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFKD", word.casefold())
        if not unicodedata.category(char).startswith("M")
    ).replace("’", "'")


def is_word(word: str) -> bool:
    if not word or word.casefold().endswith(("'s", "’s")):
        return False
    # The news source has truncated mojibake of curly punctuation (e.g. wouldnâ).
    if word.endswith("â") and word[:-1].isascii() and word[:-1].isalpha():
        return False
    # Separators must be internal and surrounded by letters, never trailing junk.
    return all(
        char.isalpha()
        or unicodedata.category(char).startswith("M")
        or (char in "'-’" and index > 0 and index + 1 < len(word)
            and word[index - 1].isalpha() and word[index + 1].isalpha())
        for index, char in enumerate(word)
    ) and word[0].isalpha()


def derive_words(news: str, aspell: str, limit: int = 100_000) -> list[str]:
    entries = []
    for line in news.splitlines():
        _, word, frequency = line.split("\t")
        entries.append((word, int(frequency)))
    # Stable sorting retains source order for equal frequencies.
    entries.sort(key=lambda entry: -entry[1])
    words = []
    seen = set()
    for word in [word for word, _ in entries[:limit]] + aspell.splitlines():
        if not is_word(word):
            continue
        key = word_key(word)
        if key in seen:
            continue
        seen.add(key)
        words.append(word.lower().replace("’", "'"))
    return words


if __name__ == "__main__":
    words = derive_words(NEWS.read_text(), ASPELL.read_text())
    OUTPUT.write_text("\n".join(words) + "\n")
    print(f"Wrote {len(words):,} unique entries to {OUTPUT.relative_to(ROOT)}")

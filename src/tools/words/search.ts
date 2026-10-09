export const MATCH_LIMIT = 300;

export interface SearchResult {
  matches: string[];
  truncated: boolean;
}

export function parseDictionary(text: string): string[] {
  const collator = new Intl.Collator("en-GB", { sensitivity: "base" });
  return text
    .split(/\r?\n/)
    .filter((word) => word.length > 0)
    .sort(collator.compare);
}

export function searchWords(words: readonly string[], pattern: string): SearchResult {
  const regex = new RegExp(pattern, "iu");
  const matches: string[] = [];
  for (const word of words) {
    if (!regex.test(word)) continue;
    if (matches.length === MATCH_LIMIT) return { matches, truncated: true };
    matches.push(word);
  }
  return { matches, truncated: false };
}

export type SearchResponse =
  | { kind: "result"; result: SearchResult }
  | { kind: "error"; message: string };

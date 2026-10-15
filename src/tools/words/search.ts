export const MATCH_LIMIT = 300;

export interface SearchResult {
  matches: string[];
  truncated: boolean;
}

export function parseDictionary(text: string): string[] {
  return text.split(/\r?\n/).filter((word) => word.length > 0);
}

export function searchWords(words: readonly string[], pattern: string, sort = false): SearchResult {
  const regex = new RegExp(pattern, "iu");
  const matches: string[] = [];
  const ordered = sort
    ? [...words].sort(new Intl.Collator("en-GB", { sensitivity: "base" }).compare)
    : words;
  for (const word of ordered) {
    if (!regex.test(word)) continue;
    if (matches.length === MATCH_LIMIT) return { matches, truncated: true };
    matches.push(word);
  }
  return { matches, truncated: false };
}

export type SearchResponse =
  | { kind: "result"; result: SearchResult }
  | { kind: "error"; message: string };

import { describe, expect, it } from "vitest";
import { MATCH_LIMIT, parseDictionary, searchWords } from "./search.ts";

describe("word search", () => {
  const words = ["Cat", "cat", "catch", "dog", "dog's", "café"];

  it("parses line endings without including empty entries", () => {
    expect(parseDictionary("cat\r\ndog\r\n\n")).toEqual(["cat", "dog"]);
  });

  it("sorts before limiting matches, ignoring case and accents", () => {
    const words = parseDictionary("G\nf\nê\nD\nc\nB\na\n");
    expect(searchWords(words, "").matches).toEqual(["a", "B", "c", "D", "ê", "f", "G"]);
    expect(parseDictionary("éclair\nEagle\nzebra\nÉcole\n")).toEqual([
      "Eagle",
      "éclair",
      "École",
      "zebra",
    ]);
  });

  it("supports substrings, anchors, alternatives, case and Unicode", () => {
    expect(searchWords(words, "cat").matches).toEqual(["Cat", "cat", "catch"]);
    expect(searchWords(words, "^(cat|dog)$").matches).toEqual(["Cat", "cat", "dog"]);
    expect(searchWords(words, "^café$").matches).toEqual(["café"]);
    expect(searchWords(words, "'s$").matches).toEqual(["dog's"]);
  });

  it("ignores case when matching but preserves accent distinctions", () => {
    expect(searchWords(["cafe", "café", "CAFÉ"], "^CAFÉ$").matches).toEqual(["café", "CAFÉ"]);
    expect(searchWords(["cafe", "café", "CAFÉ"], "^CAFE$").matches).toEqual(["cafe"]);
  });

  it("caps results in dictionary order and detects whether more exist", () => {
    const many = Array.from({ length: MATCH_LIMIT + 1 }, (_, index) => String(index));
    expect(searchWords(many, "")).toEqual({ matches: many.slice(0, MATCH_LIMIT), truncated: true });
    expect(searchWords(many.slice(0, MATCH_LIMIT), "").truncated).toBe(false);
  });

  it("handles no matches and rejects malformed regexes", () => {
    expect(searchWords(words, "^z$")).toEqual({ matches: [], truncated: false });
    expect(() => searchWords(words, "[")).toThrow();
  });
});

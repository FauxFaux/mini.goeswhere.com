import { isRecord, UnsupportedStateVersion, type UrlCodec } from "../../boot/url-state.ts";

export const MAX_PATTERN_LENGTH = 1000;

export interface WordsState {
  v: 1;
  pattern: string;
  sort: boolean;
}

export const wordsCodec: UrlCodec<WordsState> = {
  defaultState: { v: 1, pattern: "", sort: false },
  decode(value) {
    if (!isRecord(value)) throw new Error("Words state must be an object.");
    if (value.v !== 1) throw new UnsupportedStateVersion();
    if (typeof value.pattern !== "string" || value.pattern.length > MAX_PATTERN_LENGTH) {
      throw new Error("Invalid regular expression input.");
    }
    if (value.sort !== undefined && typeof value.sort !== "boolean") {
      throw new Error("Invalid sort option.");
    }
    return { v: 1, pattern: value.pattern, sort: value.sort ?? false };
  },
  query: {
    decode(params) {
      for (const key of ["v", "q", "sort"]) {
        if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key} parameter.`);
      }
      if (params.has("v") && params.get("v") !== "1") throw new UnsupportedStateVersion();
      if (params.has("sort") && params.get("sort") !== "1") throw new Error("Invalid sort option.");
      return wordsCodec.decode({ v: 1, pattern: params.get("q") ?? "", sort: params.has("sort") });
    },
    write(params, state) {
      params.delete("v");
      if (state.sort) params.set("sort", "1");
      else params.delete("sort");
      if (state.pattern) params.set("q", state.pattern);
      else params.delete("q");
    },
  },
};

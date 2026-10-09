import { isRecord, UnsupportedStateVersion, type UrlCodec } from "../../boot/url-state.ts";

export const MAX_PATTERN_LENGTH = 1000;

export interface WordsState {
  v: 1;
  pattern: string;
}

export const wordsCodec: UrlCodec<WordsState> = {
  defaultState: { v: 1, pattern: "" },
  decode(value) {
    if (!isRecord(value)) throw new Error("Words state must be an object.");
    if (value.v !== 1) throw new UnsupportedStateVersion();
    if (typeof value.pattern !== "string" || value.pattern.length > MAX_PATTERN_LENGTH) {
      throw new Error("Invalid regular expression input.");
    }
    return { v: 1, pattern: value.pattern };
  },
  query: {
    decode(params) {
      for (const key of ["v", "q"]) {
        if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key} parameter.`);
      }
      if (params.has("v") && params.get("v") !== "1") throw new UnsupportedStateVersion();
      return wordsCodec.decode({ v: 1, pattern: params.get("q") ?? "" });
    },
    write(params, state) {
      params.delete("v");
      if (state.pattern) params.set("q", state.pattern);
      else params.delete("q");
    },
  },
};

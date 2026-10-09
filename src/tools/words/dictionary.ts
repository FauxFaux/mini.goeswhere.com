import dictionaryUrl from "../../assets/aspell-wbritish.txt?url";
import { parseDictionary } from "./search.ts";

let dictionary: Promise<string[]> | undefined;

export function loadDictionary(): Promise<string[]> {
  dictionary ??= fetch(dictionaryUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Dictionary download failed (${response.status}).`);
      return parseDictionary(await response.text());
    })
    .catch((error: unknown) => {
      dictionary = undefined;
      throw error;
    });
  return dictionary;
}

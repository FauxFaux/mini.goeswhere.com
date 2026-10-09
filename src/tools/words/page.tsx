import { useEffect, useState } from "preact/hooks";
import { toWords } from "ts-number-to-words";
import dictionaryInfoUrl from "../../assets/aspell-wbritish-info.txt?url";
import { UrlHandler } from "../../boot/url-handler.tsx";
import type { State } from "../../boot/url-state.ts";
import { loadDictionary } from "./dictionary.ts";
import { MATCH_LIMIT, searchWords, type SearchResponse } from "./search.ts";
import { MAX_PATTERN_LENGTH, wordsCodec, type WordsState } from "./state.ts";
import "./words.css";

export function Words() {
  return (
    <UrlHandler codec={wordsCodec} debounceMs={200}>
      {(uss) => <WordSearch uss={uss} />}
    </UrlHandler>
  );
}

function WordSearch({ uss: [state, setState] }: { uss: State<WordsState> }) {
  const [completed, setCompleted] = useState<{
    pattern: string;
    retry: number;
    response: SearchResponse;
  }>();
  const [retry, setRetry] = useState(0);
  const pending = completed?.pattern !== state.pattern || completed?.retry !== retry;
  const response = completed?.response;
  const finish = (response: SearchResponse) =>
    setCompleted({ pattern: state.pattern, retry, response });

  useEffect(() => {
    let cancelled = false;
    const start = setTimeout(async () => {
      try {
        new RegExp(state.pattern, "iu");
        const words = await loadDictionary();
        if (!cancelled) finish({ kind: "result", result: searchWords(words, state.pattern) });
      } catch (error) {
        if (!cancelled)
          finish({
            kind: "error",
            message: error instanceof Error ? error.message : "Search failed.",
          });
      }
    }, 200);
    return () => {
      clearTimeout(start);
      cancelled = true;
    };
  }, [state.pattern, retry]);

  return (
    <>
      <h1>Words</h1>
      <p>Search the British English dictionary with a JavaScript regular expression.</p>
      <label for="words-pattern">Regular expression</label>
      <input
        class="words-pattern"
        id="words-pattern"
        type="text"
        value={state.pattern}
        maxLength={MAX_PATTERN_LENGTH}
        placeholder="ology$"
        spellcheck={false}
        onInput={(event) => setState({ ...state, pattern: event.currentTarget.value })}
        aria-describedby="words-help"
      />
      <p id="words-help" class="muted">
        Case-insensitive, accent-sensitive; searches within each word. Use ^ and $ to match a whole
        word, and enter the pattern without / delimiters. An empty pattern matches every word.
      </p>
      <div class="words-results" aria-busy={pending}>
        <div aria-live="polite" role="status">
          {response === undefined && <p>Loading dictionary and searching…</p>}
          {response?.kind === "error" && (
            <p class="error">
              {response.message}{" "}
              <button onClick={() => setRetry((value) => value + 1)}>Retry</button>
            </p>
          )}
          {response?.kind === "result" && (
            <p>
              {response.result.truncated
                ? `Showing the first ${toWords(MATCH_LIMIT)} matches; more matches exist.`
                : `${toWords(response.result.matches.length).replace(/^./, (letter) => letter.toUpperCase())} ${response.result.matches.length === 1 ? "match" : "matches"}.`}
            </p>
          )}
        </div>
        {response?.kind === "result" && (
          <ul class="words-matches">
            {response.result.matches.map((word) => (
              <li key={word}>{word}</li>
            ))}
          </ul>
        )}
      </div>
      <p class="muted">
        Matches are sorted alphabetically, ignoring case and accents. Your expression is saved in
        the URL. Word list: <a href={dictionaryInfoUrl}>ESDB / Aspell attribution and licence</a>.
      </p>
    </>
  );
}

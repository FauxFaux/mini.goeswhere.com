import { useEffect, useState } from "preact/hooks";
import { toWords } from "ts-number-to-words";
import dictionaryInfoUrl from "../../assets/aspell-wbritish-info.txt?url&no-inline";
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
    sort: boolean;
    retry: number;
    response: SearchResponse;
  }>();
  const [retry, setRetry] = useState(0);
  const pending =
    completed?.pattern !== state.pattern ||
    completed?.retry !== retry ||
    completed?.sort !== state.sort;
  const response = completed?.response;
  const finish = (response: SearchResponse) =>
    setCompleted({ pattern: state.pattern, sort: state.sort, retry, response });

  useEffect(() => {
    let cancelled = false;
    const start = setTimeout(async () => {
      try {
        new RegExp(state.pattern, "iu");
        const words = await loadDictionary();
        if (!cancelled)
          finish({ kind: "result", result: searchWords(words, state.pattern, state.sort) });
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
  }, [state.pattern, state.sort, retry]);

  return (
    <>
      <h1>Words</h1>
      <p>
        Search English news words and the British English dictionary with a JavaScript regular
        expression.
      </p>
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
      <label>
        <input
          type="checkbox"
          checked={state.sort}
          onChange={(event) => setState({ ...state, sort: event.currentTarget.checked })}
        />
        Sort alphabetically
      </label>
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
        Matches follow news frequency order, with additional Aspell words at the end. Your
        expression and sort preference are saved in the URL. Enable sorting for alphabetical order,
        ignoring case and accents. Word lists:{" "}
        <a href="https://wortschatz.uni-leipzig.de/en/download/">
          Leipzig Corpora Collection (eng_news_2025_300K)
        </a>{" "}
        and <a href={dictionaryInfoUrl}>ESDB / Aspell attribution and licence</a>.
      </p>
      <p class="muted">
        D. Goldhahn, T. Eckart &amp; U. Quasthoff: Building Large Monolingual Dictionaries at the
        Leipzig Corpora Collection: From 100 to 200 Languages. In: Proceedings of the 8th
        International Language Resources and Evaluation (LREC 2012), 2012.
      </p>
    </>
  );
}

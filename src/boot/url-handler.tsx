import type { ComponentChildren } from "preact";
import { useMemo } from "preact/hooks";
import { Link, useLocation, useSearch } from "wouter";
import { CrashHandler } from "./crash-handler.tsx";
import { navigateHash, splitHash } from "./hash-location.ts";
import { packState, readQueryState, type State, type UrlCodec } from "./url-state.ts";

export function UrlHandler<T>({
  codec,
  children,
}: {
  codec: UrlCodec<T>;
  children: (state: State<T>) => ComponentChildren;
}) {
  const [path] = useLocation();
  const search = useSearch();
  const result = useMemo(() => readQueryState(new URLSearchParams(search), codec), [search, codec]);

  const setState: State<T>[1] = (update) => {
    // Read at edit time so consecutive functional updates compose, and an old
    // callback cannot overwrite a newer navigation. There are no queued writes.
    const current = splitHash(window.location.hash);
    if (current.path !== path) return;
    const params = new URLSearchParams(current.search);
    const latest = readQueryState(params, codec);
    if (latest.kind !== "ok") return;
    const next =
      typeof update === "function" ? (update as (previous: T) => T)(latest.state) : update;
    if (codec.query) codec.query.write(params, next);
    else params.set("s", packState(next));
    navigateHash(`${path}?${params}`, { replace: true });
  };

  if (result.kind !== "ok") {
    return (
      <section role="alert">
        <h1>
          {result.kind === "version-error" ? "Unrecognised state version" : "Corrupt URL state"}
        </h1>
        <p>{result.message}</p>
        <p>
          <Link href={path}>Start fresh</Link> to clear this tool’s saved state.
        </p>
        <details>
          <summary>Saved URL</summary>
          <pre>{window.location.href}</pre>
        </details>
      </section>
    );
  }

  return (
    <CrashHandler us={result.state} resetPath={path} resetKey={`${path}?${search}`}>
      {children([result.state, setState])}
    </CrashHandler>
  );
}

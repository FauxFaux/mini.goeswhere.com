import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { Link, useLocation, useSearch } from "wouter";
import { CrashHandler } from "./crash-handler.tsx";
import { beforeHashNavigation } from "./hash-location.ts";
import { readQueryState, type State, type UrlCodec } from "./url-state.ts";
import { createUrlWriteBuffer } from "./url-write-buffer.ts";

export function UrlHandler<T>({
  codec,
  debounceMs = 0,
  children,
}: {
  codec: UrlCodec<T>;
  debounceMs?: number;
  children: (state: State<T>) => ComponentChildren;
}) {
  const [path] = useLocation();
  const search = useSearch();
  const result = useMemo(() => readQueryState(new URLSearchParams(search), codec), [search, codec]);
  const [, rerender] = useState(0);
  const buffer = useMemo(
    () => createUrlWriteBuffer(codec, path, debounceMs, () => rerender((value) => value + 1)),
    [codec, path, debounceMs],
  );
  useEffect(() => {
    const unsubscribe = beforeHashNavigation(buffer.flush);
    window.addEventListener("hashchange", buffer.onNavigation);
    window.addEventListener("popstate", buffer.onNavigation);
    window.addEventListener("pagehide", buffer.flush);
    document.addEventListener("pointerup", buffer.flush);
    document.addEventListener("pointercancel", buffer.flush);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") buffer.flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      window.removeEventListener("hashchange", buffer.onNavigation);
      window.removeEventListener("popstate", buffer.onNavigation);
      window.removeEventListener("pagehide", buffer.flush);
      document.removeEventListener("pointerup", buffer.flush);
      document.removeEventListener("pointercancel", buffer.flush);
      document.removeEventListener("visibilitychange", onVisibility);
      buffer.dispose();
    };
  }, [buffer]);

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

  const state = buffer.state() ?? result.state;
  return (
    <CrashHandler us={state} resetPath={path} resetKey={`${path}?${search}`}>
      {children([state, buffer.setState])}
    </CrashHandler>
  );
}

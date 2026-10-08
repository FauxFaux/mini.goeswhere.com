import { navigateHash, splitHash } from "./hash-location.ts";
import {
  packState,
  readQueryState,
  type State,
  type StateResult,
  type UrlCodec,
} from "./url-state.ts";

/** Keep fast edits in memory until persistence, guarded by their originating URL. */
export function createUrlWriteBuffer<T>(
  codec: UrlCodec<T>,
  path: string,
  debounceMs: number,
  onChange: () => void,
) {
  let pending: { href: string; state: T } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function discard() {
    clearTimer();
    if (!pending) return;
    pending = undefined;
    onChange();
  }

  function flush() {
    clearTimer();
    const edit = pending;
    pending = undefined;
    if (!edit || disposed) return;
    const current = splitHash(window.location.hash);
    if (edit.href === window.location.href && current.path === path) {
      const params = new URLSearchParams(current.search);
      if (codec.query) codec.query.write(params, edit.state);
      else params.set("s", packState(edit.state));
      const search = params.toString();
      navigateHash(`${path}${search ? `?${search}` : ""}`, { replace: true });
    }
    onChange();
  }

  const setState: State<T>[1] = (update) => {
    if (disposed) return;
    const current = splitHash(window.location.hash);
    if (current.path !== path) return;
    const latest: StateResult<T> =
      pending?.href === window.location.href
        ? { kind: "ok", state: pending.state }
        : readQueryState(new URLSearchParams(current.search), codec);
    if (latest.kind !== "ok") return;
    const next =
      typeof update === "function" ? (update as (previous: T) => T)(latest.state) : update;
    pending = { href: window.location.href, state: next };
    clearTimer();
    if (debounceMs > 0) {
      onChange();
      timer = setTimeout(flush, debounceMs);
    } else flush();
  };

  return {
    setState,
    flush,
    discard,
    /** External URL changes supersede unpersisted edits, even on the same tool. */
    onNavigation() {
      if (pending && pending.href !== window.location.href) discard();
    },
    state(): T | undefined {
      return pending?.href === window.location.href ? pending.state : undefined;
    },
    dispose() {
      disposed = true;
      clearTimer();
      pending = undefined;
    },
  };
}

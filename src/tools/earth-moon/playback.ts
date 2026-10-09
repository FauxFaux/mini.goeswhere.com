import { useEffect, useRef, useState } from "preact/hooks";
import type { State } from "../../boot/url-state.ts";
import { dayMs } from "./astronomy.ts";
import { earthMoonCodec, maxInstant, type EarthMoonState } from "./state.ts";
import { splitHash } from "../../boot/hash-location.ts";

export type PlaybackMode = "hours" | "days";

export function usePlayback([state, setState]: State<EarthMoonState>) {
  const [mode, setMode] = useState<PlaybackMode>();
  const [frozenInstant, setFrozenInstant] = useState<number>();
  const latest = useRef({ state, setState });
  latest.current = { state, setState };
  const frame = useRef<number>();
  const expectedHref = useRef<string>();

  const expectWrite = (updated: EarthMoonState) => {
    const url = new URL(window.location.href);
    const { path, search } = splitHash(url.hash);
    const params = new URLSearchParams(search);
    earthMoonCodec.query!.write(params, updated);
    url.hash = `${path}?${params}`;
    expectedHref.current = url.href;
  };

  const stop = () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
    setMode(undefined);
  };
  const edit: State<EarthMoonState>[1] = (update) => {
    setState((previous) => {
      const updated = typeof update === "function" ? update(previous) : update;
      if (updated.instant !== previous.instant) {
        stop();
        setFrozenInstant(undefined);
      }
      expectWrite(updated);
      return updated;
    });
  };
  const toggle = (next: PlaybackMode) => {
    stop();
    if (next === mode) return;
    if (state.instant >= maxInstant) return;
    setFrozenInstant(next === "days" ? (frozenInstant ?? state.instant) : undefined);
    setMode(next);
  };

  useEffect(() => {
    if (!mode) return;
    const start = performance.now();
    const instant = latest.current.state.instant;
    let origin = window.location.href;
    const rate = mode === "hours" ? (3 * dayMs) / 24 : 3 * dayMs;
    const tick = (now: number) => {
      // Never let a frame overwrite a newly opened shared link, even before its event fires.
      if (window.location.href === expectedHref.current) origin = window.location.href;
      if (window.location.href !== origin || document.visibilityState === "hidden") {
        stop();
        setFrozenInstant(undefined);
        return;
      }
      const next = Math.min(maxInstant, instant + Math.round(((now - start) * rate) / 1000));
      latest.current.setState((previous) => {
        const updated = { ...previous, instant: next };
        expectWrite(updated);
        return updated;
      });
      if (next === maxInstant) stop();
      else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      frame.current = undefined;
    };
  }, [mode]);

  useEffect(() => {
    const onNavigation = () => {
      if (window.location.href === expectedHref.current) return;
      stop();
      setFrozenInstant(undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    window.addEventListener("hashchange", onNavigation);
    window.addEventListener("popstate", onNavigation);
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("hashchange", onNavigation);
      window.removeEventListener("popstate", onNavigation);
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return {
    mode,
    toggle,
    edit,
    frozenDays: frozenInstant === undefined ? 0 : (state.instant - frozenInstant) / dayMs,
  };
}

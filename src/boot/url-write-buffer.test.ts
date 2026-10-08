// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { beforeHashNavigation, navigateHash } from "./hash-location.ts";
import type { UrlCodec } from "./url-state.ts";
import { createUrlWriteBuffer } from "./url-write-buffer.ts";

const codec: UrlCodec<{ value: number }> = {
  defaultState: { value: 0 },
  decode: (value) => value as { value: number },
  query: {
    decode: (params) => ({ value: Number(params.get("value") ?? 0) }),
    write: (params, state) => params.set("value", String(state.value)),
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/?host=keep#/buffer?note=keep&value=0");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("composes fast edits locally and writes once after the last edit's quiet period", () => {
  const changed = vi.fn();
  const buffer = createUrlWriteBuffer(codec, "/buffer", 250, changed);
  const replace = vi.spyOn(window.history, "replaceState");
  const length = window.history.length;
  for (let index = 0; index < 100; index++)
    buffer.setState((previous) => ({ value: previous.value + 1 }));
  expect(buffer.state()).toEqual({ value: 100 });
  expect(changed).toHaveBeenCalledTimes(100);
  expect(replace).not.toHaveBeenCalled();
  vi.advanceTimersByTime(200);
  buffer.setState((previous) => ({ value: previous.value + 1 }));
  vi.advanceTimersByTime(249);
  expect(replace).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(replace).toHaveBeenCalledTimes(1);
  expect(window.location.hash).toBe("#/buffer?note=keep&value=101");
  expect(window.location.search).toBe("?host=keep");
  expect(window.history.length).toBe(length);
  expect(buffer.state()).toBeUndefined();
  buffer.dispose();
});

it("flushes pending state before app navigation so the previous history entry is current", () => {
  const buffer = createUrlWriteBuffer(codec, "/buffer", 250, vi.fn());
  const unsubscribe = beforeHashNavigation(buffer.flush);
  const replace = vi.spyOn(window.history, "replaceState");
  buffer.setState({ value: 42 });
  navigateHash("/other");
  expect(replace).toHaveBeenCalledTimes(1);
  expect(String(replace.mock.calls[0][2])).toContain("#/buffer?note=keep&value=42");
  expect(window.location.hash).toBe("#/other");
  vi.advanceTimersByTime(1000);
  expect(replace).toHaveBeenCalledTimes(1);
  expect(window.location.hash).toBe("#/other");
  unsubscribe();
  buffer.dispose();
});

it.each(["#/other", "#/buffer?value=99"])("cannot overwrite an incoming URL: %s", (hash) => {
  const buffer = createUrlWriteBuffer(codec, "/buffer", 250, vi.fn());
  buffer.setState({ value: 42 });
  window.history.replaceState(null, "", hash);
  const replace = vi.spyOn(window.history, "replaceState");
  vi.advanceTimersByTime(1000);
  expect(replace).not.toHaveBeenCalled();
  expect(window.location.hash).toBe(hash);
  buffer.dispose();
});

it("discards edits on history changes even if the original URL is later restored", () => {
  const buffer = createUrlWriteBuffer(codec, "/buffer", 250, vi.fn());
  const original = window.location.href;
  buffer.setState({ value: 42 });
  window.history.replaceState(null, "", "#/other");
  buffer.onNavigation();
  window.history.replaceState(null, "", original);
  vi.advanceTimersByTime(1000);
  expect(window.location.href).toBe(original);
  expect(buffer.state()).toBeUndefined();
  buffer.dispose();
});

it("composes against an external same-tool URL rather than stale edits", () => {
  const buffer = createUrlWriteBuffer(codec, "/buffer", 250, vi.fn());
  buffer.setState({ value: 42 });
  window.history.replaceState(null, "", "#/buffer?value=99");
  buffer.setState((previous) => ({ value: previous.value + 1 }));
  buffer.flush();
  expect(window.location.hash).toBe("#/buffer?value=100");
  buffer.dispose();
});

it("cancels timers and stale setters on disposal", () => {
  const buffer = createUrlWriteBuffer(codec, "/buffer", 250, vi.fn());
  const original = window.location.href;
  buffer.setState({ value: 42 });
  buffer.dispose();
  buffer.setState({ value: 99 });
  vi.advanceTimersByTime(1000);
  expect(window.location.href).toBe(original);
});

it("keeps immediate persistence for tools without debounce", () => {
  const buffer = createUrlWriteBuffer(codec, "/buffer", 0, vi.fn());
  buffer.setState((previous) => ({ value: previous.value + 1 }));
  buffer.setState((previous) => ({ value: previous.value + 1 }));
  expect(window.location.hash).toBe("#/buffer?note=keep&value=2");
  buffer.dispose();
});

import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("loads lazily and shares a single dictionary download", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "cat\ndog\n" });
  vi.stubGlobal("fetch", fetch);
  const { loadDictionary } = await import("./dictionary.ts");
  expect(fetch).not.toHaveBeenCalled();
  expect(await Promise.all([loadDictionary(), loadDictionary()])).toEqual([
    ["cat", "dog"],
    ["cat", "dog"],
  ]);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("allows another attempt after a failed download", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: true, text: async () => "cat\n" });
  vi.stubGlobal("fetch", fetch);
  const { loadDictionary } = await import("./dictionary.ts");
  await expect(loadDictionary()).rejects.toThrow("503");
  expect(await loadDictionary()).toEqual(["cat"]);
});

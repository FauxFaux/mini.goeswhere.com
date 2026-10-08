import { afterEach, describe, expect, it, vi } from "vitest";
import { CalculatorEngine } from "./engine.ts";

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: Worker["onerror"] = null;
  onmessageerror: Worker["onmessageerror"] = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  reply(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
const signal = () => new AbortController().signal;
const result = {
  input: "1 + 1",
  output: "2",
  approximate: false,
  resultIsComparison: false,
  messages: [],
};
afterEach(() => vi.useRealTimers());

describe("calculator worker lifecycle", () => {
  it("loads lazily, shares initialization and serializes requests", async () => {
    const worker = new FakeWorker();
    const factory = vi.fn(() => worker);
    const engine = new CalculatorEngine(factory);
    expect(factory).not.toHaveBeenCalled();
    const first = engine.calculate("1+1", signal());
    const second = engine.calculate("2+2", signal());
    expect(factory).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).not.toHaveBeenCalled();
    worker.reply({ ready: true });
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({
      id: 1,
      expression: "1+1",
      timeoutMs: 2000,
    });
    worker.reply({ id: 1, result });
    expect(await first).toEqual(result);
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      id: 2,
      expression: "2+2",
      timeoutMs: 2000,
    });
    worker.reply({ id: 2, result: { ...result, output: "4" } });
    expect((await second).output).toBe("4");
    engine.dispose();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("drops cancelled queued work and ignores cancelled active results", async () => {
    const worker = new FakeWorker();
    const engine = new CalculatorEngine(() => worker);
    const active = new AbortController();
    const queued = new AbortController();
    const first = engine.calculate("old", active.signal).catch((error: Error) => error.message);
    worker.reply({ ready: true });
    const second = engine
      .calculate("obsolete", queued.signal)
      .catch((error: Error) => error.message);
    active.abort();
    queued.abort();
    expect(await first).toBe("Calculation cancelled");
    expect(await second).toBe("Calculation cancelled");
    const latest = engine.calculate("new", signal());
    worker.reply({ id: 1, result });
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      id: 3,
      expression: "new",
      timeoutMs: 2000,
    });
    worker.reply({ id: 1, result });
    worker.reply({ id: 3, result });
    expect(await latest).toEqual(result);
    engine.dispose();
  });

  it.each(["initialization", "calculation"])(
    "terminates a hung %s and can retry",
    async (phase) => {
      vi.useFakeTimers();
      const workers = [new FakeWorker(), new FakeWorker()];
      const engine = new CalculatorEngine(() => workers.shift()!);
      const worker = workers[0];
      const pending = engine
        .calculate("factor(2^256+1)", signal())
        .catch((error: Error) => error.message);
      if (phase === "calculation") worker.reply({ ready: true });
      await vi.advanceTimersByTimeAsync(phase === "calculation" ? 5000 : 30000);
      expect(await pending).toMatch(
        phase === "calculation" ? /exceeded 5 seconds/ : /could not load/,
      );
      expect(worker.terminate).toHaveBeenCalledOnce();
      const replacement = workers[0];
      const retry = engine.calculate("1+1", signal());
      worker.reply({ ready: true }); // Old runtime cannot change replacement state.
      expect(replacement.postMessage).not.toHaveBeenCalled();
      replacement.reply({ ready: true });
      replacement.reply({ id: 2, result });
      expect(await retry).toEqual(result);
      engine.dispose();
    },
  );

  it("rejects queued jobs on runtime failure and during unmount", async () => {
    const worker = new FakeWorker();
    const engine = new CalculatorEngine(() => worker);
    const first = engine.calculate("1+1", signal()).catch((error: Error) => error.message);
    const second = engine.calculate("2+2", signal()).catch((error: Error) => error.message);
    worker.reply({ error: "Runtime trap" });
    expect(await first).toBe("Runtime trap");
    expect(await second).toBe("Runtime trap");
    const pending = engine.calculate("3+3", signal()).catch((error: Error) => error.message);
    engine.dispose();
    expect(await pending).toBe("Calculation cancelled");
    await expect(engine.calculate("4+4", signal())).rejects.toThrow("cancelled");
  });
});

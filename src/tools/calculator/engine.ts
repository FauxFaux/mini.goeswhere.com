import type { CalculationResult } from "../../assets/qalculate.mjs";

export type WorkerReply =
  | { ready: true }
  | { id: number; result: CalculationResult }
  | { error: string };

type CalculatorWorker = Pick<
  Worker,
  "postMessage" | "terminate" | "onmessage" | "onerror" | "onmessageerror"
>;
interface Job {
  id: number;
  expression: string;
  signal: AbortSignal;
  resolve: (result: CalculationResult) => void;
  reject: (error: Error) => void;
  abort: () => void;
}

/** One isolated runtime per mounted calculator; requests run sequentially. */
export class CalculatorEngine {
  private worker?: CalculatorWorker;
  private ready = false;
  private disposed = false;
  private nextId = 0;
  private queue: Job[] = [];
  private active?: Job;
  private deadline?: ReturnType<typeof setTimeout>;

  private readonly createWorker: () => CalculatorWorker;

  constructor(
    createWorker: () => CalculatorWorker = () =>
      new Worker(new URL("./calculator.worker.ts", import.meta.url), { type: "module" }),
  ) {
    this.createWorker = createWorker;
  }

  calculate(expression: string, signal: AbortSignal): Promise<CalculationResult> {
    return new Promise((resolve, reject) => {
      if (signal.aborted || this.disposed) {
        reject(new Error("Calculation cancelled"));
        return;
      }
      const job: Job = {
        id: ++this.nextId,
        expression,
        signal,
        resolve,
        reject,
        abort: () => {
          this.queue = this.queue.filter((item) => item !== job);
          this.settle(job, new Error("Calculation cancelled"));
        },
      };
      signal.addEventListener("abort", job.abort, { once: true });
      this.queue.push(job);
      if (!this.worker) this.start();
      this.dispatch();
    });
  }

  dispose() {
    this.disposed = true;
    this.fail("Calculation cancelled");
  }

  private start() {
    try {
      const worker = this.createWorker();
      this.worker = worker;
      this.deadline = setTimeout(
        () => this.fail("Calculator could not load within 30 seconds. Retry to reload."),
        30000,
      );
      worker.onmessage = (event: MessageEvent<WorkerReply>) => {
        if (this.worker !== worker) return;
        const reply = event.data;
        if ("error" in reply) {
          this.fail(reply.error);
        } else if ("ready" in reply) {
          clearTimeout(this.deadline);
          this.ready = true;
          this.dispatch();
        } else if (this.active?.id === reply.id) {
          clearTimeout(this.deadline);
          const job = this.active;
          this.active = undefined;
          job.signal.removeEventListener("abort", job.abort);
          job.resolve(reply.result);
          this.dispatch();
        }
      };
      worker.onerror = (event) => {
        event.preventDefault();
        if (this.worker !== worker) return;
        this.fail(event.message || "Calculator worker failed. Retry to reload.");
      };
      worker.onmessageerror = () => {
        if (this.worker === worker)
          this.fail("Could not read the calculator response. Retry to reload.");
      };
    } catch (error) {
      this.fail(error instanceof Error ? error.message : "Could not load calculator");
    }
  }

  private dispatch() {
    if (!this.ready || this.active || !this.worker) return;
    const job = this.queue.shift();
    if (!job) return;
    this.active = job;
    // libqalculate's cooperative timeout does not cover every calculation path.
    this.deadline = setTimeout(
      () => this.fail("Calculation exceeded 5 seconds. Retry to reload."),
      5000,
    );
    try {
      this.worker.postMessage({ id: job.id, expression: job.expression, timeoutMs: 2000 });
    } catch (error) {
      this.fail(error instanceof Error ? error.message : "Could not send calculation");
    }
  }

  private settle(job: Job, error: Error) {
    job.signal.removeEventListener("abort", job.abort);
    job.reject(error);
  }

  private fail(message: string) {
    clearTimeout(this.deadline);
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = false;
    const jobs = this.active ? [this.active, ...this.queue] : this.queue;
    this.active = undefined;
    this.queue = [];
    for (const job of jobs) this.settle(job, new Error(message));
  }
}

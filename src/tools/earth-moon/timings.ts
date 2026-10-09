export type TimingStats = { live: number; mean: number; max: number; count: number };

/** Samples belong to one explorer mount, never to URL state. */
export class EarthMoonTimings {
  private samples = new Map<string, { at: number; duration: number }[]>();

  private now: () => number;

  constructor(now: () => number = () => performance.now()) {
    this.now = now;
  }

  measure<T>(phase: string, calculate: () => T): T {
    const start = this.now();
    try {
      return calculate();
    } finally {
      const at = this.now();
      const samples = this.samples.get(phase) ?? [];
      samples.push({ at, duration: at - start });
      this.prune(samples, at);
      this.samples.set(phase, samples);
    }
  }

  private prune(samples: { at: number; duration: number }[], now: number) {
    const first = samples.findIndex((sample) => sample.at >= now - 5000);
    if (first === -1) samples.length = 0;
    else if (first > 0) samples.splice(0, first);
  }

  read(): Map<string, TimingStats> {
    const now = this.now();
    const result = new Map<string, TimingStats>();
    for (const [phase, samples] of this.samples) {
      this.prune(samples, now);
      if (!samples.length) continue;
      let sum = 0;
      let max = 0;
      for (const sample of samples) {
        sum += sample.duration;
        max = Math.max(max, sample.duration);
      }
      result.set(phase, {
        live: samples[samples.length - 1]!.duration,
        mean: sum / samples.length,
        max,
        count: samples.length,
      });
    }
    return result;
  }
}

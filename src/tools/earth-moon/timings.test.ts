import { expect, it } from "vitest";
import { EarthMoonTimings } from "./timings.ts";

it("reports the latest call and rolling five-second statistics independently per phase", () => {
  let now = 0;
  const timings = new EarthMoonTimings(() => now);
  const sample = (phase: string, duration: number) =>
    timings.measure(phase, () => {
      now += duration;
      return "result";
    });
  expect(sample("Build", 10)).toBe("result");
  now = 1000;
  sample("Build", 30);
  sample("Render", 5);
  expect(timings.read().get("Build")).toEqual({ live: 30, mean: 20, max: 30, count: 2 });
  expect(timings.read().get("Render")?.live).toBe(5);
  now = 5011;
  expect(timings.read().get("Build")).toEqual({ live: 30, mean: 30, max: 30, count: 1 });
  now = 6036;
  expect(timings.read().size).toBe(0);
  sample("Build", 2);
  expect(timings.read().get("Build")).toEqual({ live: 2, mean: 2, max: 2, count: 1 });
});

it("records nested phases and preserves thrown errors", () => {
  let now = 0;
  const timings = new EarthMoonTimings(() => now);
  const error = new Error("render failed");
  expect(() =>
    timings.measure("Update", () => {
      now += 2;
      timings.measure("Render", () => {
        now += 3;
        throw error;
      });
    }),
  ).toThrow(error);
  expect(timings.read().get("Update")?.live).toBe(5);
  expect(timings.read().get("Render")?.live).toBe(3);
});

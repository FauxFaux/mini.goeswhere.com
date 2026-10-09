// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/preact";
import { afterEach, expect, it, vi } from "vitest";
import { TimingPanel } from "./timing-panel.tsx";
import { EarthMoonTimings } from "./timings.ts";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("copies fresh readings with units and reports clipboard failures", async () => {
  let now = 0;
  const timings = new EarthMoonTimings(() => now);
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  render(<TimingPanel timings={timings} />);
  const details = screen.getByText("Performance timings").closest("details")!;
  details.open = true;
  await act(async () => {
    fireEvent(details, new Event("toggle"));
  });
  timings.measure("Space: Render", () => {
    now += 4;
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copy timings" }));
  });
  expect(write).toHaveBeenCalledOnce();
  const copied = write.mock.calls[0]![0];
  expect(copied).toContain("5s mean (ms)");
  expect(copied).toContain("Space: Render\t4.00\t4.00\t4.00\t1");
  expect(copied).toContain("Sky: Render\t—\t—\t—\t0");
  expect(screen.getByRole("status").textContent).toBe("Timings copied.");
  write.mockRejectedValue(new Error("Permission denied"));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copy timings" }));
  });
  expect(screen.getByRole("status").textContent).toContain("Could not copy timings.");
});

it("refreshes only while expanded and clears expired samples", async () => {
  vi.useFakeTimers();
  let now = 0;
  const timings = new EarthMoonTimings(() => now);
  render(<TimingPanel timings={timings} />);
  expect(vi.getTimerCount()).toBe(0);
  timings.measure("Snapshot", () => {
    now = 12;
  });
  const details = screen.getByText("Performance timings").closest("details")!;
  details.open = true;
  await act(async () => {
    fireEvent(details, new Event("toggle"));
  });
  const row = screen.getByRole("rowheader", { name: "Snapshot" }).closest("tr")!;
  expect(
    within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["12.00", "12.00", "12.00", "1"]);
  now = 5013;
  act(() => {
    vi.advanceTimersByTime(250);
  });
  expect(
    within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["—", "—", "—", "0"]);
  details.open = false;
  await act(async () => {
    fireEvent(details, new Event("toggle"));
  });
  expect(vi.getTimerCount()).toBe(0);
});

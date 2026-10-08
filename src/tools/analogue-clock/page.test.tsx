// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { Temporal } from "temporal-polyfill";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as cityFunctions from "../../components/location-picker/cities.ts";
import { App } from "../../app.tsx";
import { navigateHash, splitHash } from "../../boot/hash-location.ts";
import { currentYear } from "./year.ts";
import { pointOnClock } from "./clock.ts";
import { analogueClockCodec } from "./state.ts";

beforeEach(() => window.history.replaceState(null, "", "/#/analogue-clock?note=keep&s=0"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function minutes() {
  return (
    Number(screen.getByRole("slider", { name: "Hour hand" }).getAttribute("aria-valuenow")) * 60
  );
}

function persistedState() {
  return analogueClockCodec.query!.decode(
    new URLSearchParams(splitHash(window.location.hash).search),
  );
}

it("toggles number rings independently, persists them through dragging and restores them through history", async () => {
  const user = userEvent.setup();
  const { svg, pointer } = await face();
  const initialUrl = window.location.href;
  const historyLength = window.history.length;
  const twelve = screen.getByRole("checkbox", { name: "12-hour numbers" }) as HTMLInputElement;
  const twentyFour = screen.getByRole("checkbox", { name: "24-hour numbers" }) as HTMLInputElement;
  const minuteNumbers = screen.getByRole("checkbox", { name: "Minutes" }) as HTMLInputElement;
  expect(twelve.checked).toBe(true);
  expect(twentyFour.checked).toBe(false);
  expect(minuteNumbers.checked).toBe(false);
  expect(svg.querySelectorAll(".analogue-clock-major-tick")).toHaveLength(12);
  expect(window.location.href).toBe(initialUrl);
  await user.click(twentyFour);
  await user.click(minuteNumbers);
  expect(svg.querySelectorAll(".analogue-clock-major-tick")).toHaveLength(0);
  expect(svg.querySelectorAll(".analogue-clock-minor-tick")).toHaveLength(48);
  const minuteTexts = Array.from(svg.querySelectorAll(".analogue-clock-numbers-minutes text"));
  expect(minuteTexts.find((text) => text.textContent === "25")?.getAttribute("transform")).toMatch(
    /^rotate\(150 /,
  );
  expect(minuteTexts.find((text) => text.textContent === "35")?.getAttribute("transform")).toMatch(
    /^rotate\(-150 /,
  );
  await user.click(twelve);
  expect(svg.querySelector(".analogue-clock-numbers-12h")).toBeNull();
  expect(
    Array.from(
      svg.querySelectorAll(".analogue-clock-numbers-24h text"),
      (text) => text.textContent,
    ),
  ).toEqual(["24", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"]);
  expect(
    Array.from(
      svg.querySelectorAll(".analogue-clock-numbers-minutes text"),
      (text) => text.textContent,
    ),
  ).toEqual(["60", "5", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]);
  pointer("pointerDown", 30, 230);
  pointer("pointerMove", 60, 230);
  pointer("pointerUp", 60, 230);
  const params = new URLSearchParams(splitHash(window.location.hash).search);
  expect(analogueClockCodec.query!.decode(params)).toEqual({
    v: 2,
    seconds: 300,
    show12HourNumbers: false,
    show24HourNumbers: true,
    showMinuteNumbers: true,
    sideBySide: false,
    location: { latitude: 51.5074, longitude: -0.1278 },
  });
  expect(params.get("note")).toBe("keep");
  expect(window.history.length).toBe(historyLength);
  const shared = window.location.hash;
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  const restored = (await screen.findByRole("checkbox", {
    name: "12-hour numbers",
  })) as HTMLInputElement;
  expect(restored.checked).toBe(false);
  expect(
    (screen.getByRole("checkbox", { name: "24-hour numbers" }) as HTMLInputElement).checked,
  ).toBe(true);
  expect((screen.getByRole("checkbox", { name: "Minutes" }) as HTMLInputElement).checked).toBe(
    true,
  );
  expect(window.location.hash).toBe(shared);
  cleanup();
  render(<App />);
  expect(
    ((await screen.findByRole("checkbox", { name: "Minutes" })) as HTMLInputElement).checked,
  ).toBe(true);
});

it("flushes an unpersisted edit before leaving the tool and restores it on Back", async () => {
  await face();
  fireEvent.keyDown(screen.getByRole("slider", { name: "Minute hand" }), { key: "ArrowUp" });
  expect(minutes()).toBe(1);
  expect(persistedState().seconds / 60).toBe(0);
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  await screen.findByRole("slider", { name: "Minute hand" });
  expect(minutes()).toBe(1);
  expect(persistedState().seconds / 60).toBe(1);
});

it("incoming same-tool links cancel pending edits rather than being overwritten", async () => {
  await face();
  fireEvent.keyDown(screen.getByRole("slider", { name: "Minute hand" }), { key: "ArrowUp" });
  expect(minutes()).toBe(1);
  act(() => navigateHash("/analogue-clock?s=5400&t=1", { replace: true }));
  await waitFor(() => expect(minutes()).toBe(90));
  const incoming = window.location.href;
  const replace = vi.spyOn(window.history, "replaceState");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  expect(window.location.href).toBe(incoming);
  expect(replace).not.toHaveBeenCalled();
  expect(
    (screen.getByRole("checkbox", { name: "24-hour numbers" }) as HTMLInputElement).checked,
  ).toBe(true);
});

async function face(size = 500) {
  render(<App />);
  const svg = await screen.findByRole("group", { name: "Interactive analogue clock" });
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, size, size));
  const captures = new Set<number>();
  const set = vi.fn((id: number) => captures.add(id));
  const release = vi.fn((id: number) => captures.delete(id));
  Object.defineProperties(svg, {
    setPointerCapture: { value: set, configurable: true },
    hasPointerCapture: { value: (id: number) => captures.has(id), configurable: true },
    releasePointerCapture: { value: release, configurable: true },
  });
  function pointer(
    type: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel" | "lostPointerCapture",
    degrees: number,
    radius = 194,
    pointerId = 1,
  ) {
    const point = pointOnClock(degrees, radius);
    fireEvent[type](svg, {
      pointerId,
      pointerType: "touch",
      button: 0,
      clientX: 10 + size / 2 + (point.x * size) / 500,
      clientY: 20 + size / 2 + (point.y * size) / 500,
    });
  }
  return { svg, pointer, set, release };
}

it("captures a touch drag, smoothly couples the hands and preserves URL history", async () => {
  const { pointer, set, release } = await face();
  const original = window.location.href;
  const length = window.history.length;
  pointer("pointerDown", 4);
  expect(window.location.href).toBe(original); // Grabbing off-centre must not jump.
  expect(set).toHaveBeenCalledWith(1);
  for (const angle of [94, 184, 274, 364]) pointer("pointerMove", angle);
  expect(minutes()).toBeCloseTo(60);
  expect(
    Number(screen.getByRole("slider", { name: "Hour hand" }).getAttribute("aria-valuenow")),
  ).toBeCloseTo(1);
  pointer("pointerUp", 364);
  expect(release).toHaveBeenCalledWith(1);
  pointer("pointerMove", 454);
  expect(minutes()).toBeCloseTo(60);
  expect(window.history.length).toBe(length);
  expect(new URLSearchParams(splitHash(window.location.hash).search).get("note")).toBe("keep");
});

it("keeps rapid dragging local and writes a readable URL once the gesture ends", async () => {
  const { pointer } = await face();
  const original = window.location.href;
  const replace = vi.spyOn(window.history, "replaceState");
  pointer("pointerDown", 0);
  for (let angle = 6; angle <= 360; angle += 6) pointer("pointerMove", angle);
  expect(minutes()).toBeCloseTo(60);
  expect(window.location.href).toBe(original);
  expect(replace).not.toHaveBeenCalled();
  pointer("pointerUp", 360);
  expect(replace).toHaveBeenCalledTimes(1);
  expect(window.location.hash).toBe("#/analogue-clock?note=keep&s=3600");
  expect(persistedState().seconds / 60).toBeCloseTo(60);
});

it("drags the hour hand, including backwards across twelve", async () => {
  window.history.replaceState(null, "", "/#/analogue-clock?s=3600");
  const { pointer } = await face();
  pointer("pointerDown", 30, 120);
  pointer("pointerMove", 0, 120);
  pointer("pointerMove", -30, 120);
  expect(minutes()).toBeCloseTo(660);
  pointer("pointerUp", -30, 120);
  expect(screen.getByRole("slider", { name: "Hour hand" }).getAttribute("aria-valuetext")).toBe(
    "11 hours, 0 minutes",
  );
});

it("starts a minute drag anywhere in overlapping backup sectors without jumping", async () => {
  window.history.replaceState(null, "", "/#/analogue-clock?s=3600");
  const { pointer, set } = await face(300);
  const original = window.location.href;
  pointer("pointerDown", 20, 230);
  expect(set).toHaveBeenCalledWith(1);
  expect(window.location.href).toBe(original);
  pointer("pointerMove", 50, 230);
  expect(minutes()).toBeCloseTo(65);
  pointer("pointerUp", 50, 230);
});

it("starts an hour drag near the rim in its backup sector", async () => {
  window.history.replaceState(null, "", "/#/analogue-clock?s=10800");
  const { pointer, set } = await face();
  pointer("pointerDown", 110, 230);
  expect(set).toHaveBeenCalledWith(1);
  expect(minutes()).toBe(180);
  pointer("pointerMove", 125, 230);
  expect(minutes()).toBeCloseTo(210);
  pointer("pointerUp", 125, 230);
});

it("keeps a captured drag working outside a small clock and ignores extra fingers", async () => {
  const { pointer, set } = await face(300);
  pointer("pointerDown", 0);
  pointer("pointerDown", 0, 120, 2);
  pointer("pointerMove", 90, 194, 2);
  pointer("pointerUp", 90, 194, 2);
  expect(set).toHaveBeenCalledTimes(1);
  expect(minutes()).toBe(0);
  pointer("pointerMove", 90, 350);
  expect(minutes()).toBeCloseTo(15);
  pointer("pointerUp", 90, 350);
});

it.each(["pointerCancel", "lostPointerCapture"] as const)(
  "ends a drag on %s and permits another hand to be grabbed",
  async (type) => {
    const { pointer, svg } = await face();
    pointer("pointerDown", 0);
    pointer("pointerMove", 90);
    pointer(type, 90);
    expect(svg.classList.contains("analogue-clock-dragging")).toBe(false);
    pointer("pointerMove", 180);
    expect(minutes()).toBeCloseTo(15);
    pointer("pointerDown", 90);
    pointer("pointerMove", 180);
    expect(minutes()).toBeCloseTo(30);
  },
);

it("ignores touches away from hands and re-anchors after crossing the pivot", async () => {
  const { pointer, set } = await face();
  pointer("pointerDown", 90);
  pointer("pointerDown", 0, 0);
  expect(set).not.toHaveBeenCalled();
  pointer("pointerDown", 0);
  pointer("pointerMove", 0, 0);
  pointer("pointerMove", 180);
  expect(minutes()).toBe(0);
  pointer("pointerMove", 270);
  expect(minutes()).toBeCloseTo(15);
});

it("supports keyboard editing, link restoration and Back navigation", async () => {
  await face();
  const minute = screen.getByRole("slider", { name: "Minute hand" });
  fireEvent.keyDown(minute, { key: "ArrowLeft" });
  expect(minutes()).toBe(719);
  fireEvent.keyDown(minute, { key: "PageUp" });
  expect(minutes()).toBe(4);
  fireEvent.keyDown(screen.getByRole("slider", { name: "Hour hand" }), { key: "ArrowUp" });
  expect(minutes()).toBe(64);
  await waitFor(() => expect(persistedState().seconds / 60).toBe(64));
  const shared = window.location.hash;
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  await screen.findByRole("slider", { name: "Minute hand" });
  expect(window.location.hash).toBe(shared);
  expect(screen.getByRole("slider", { name: "Hour hand" }).getAttribute("aria-valuetext")).toBe(
    "1 hours, 4 minutes",
  );
  window.location.hash = "/analogue-clock?s=5400";
  await waitFor(() =>
    expect(screen.getByRole("slider", { name: "Hour hand" }).getAttribute("aria-valuenow")).toBe(
      "1.5",
    ),
  );
});

it.each([
  [`s=${currentYear.seconds}`, "Corrupt URL state"],
  ["v=3&s=0", "Unrecognised state version"],
  ["s=0&lat=91&lon=0", "Corrupt URL state"],
])("preserves invalid links and offers recovery", async (query, heading) => {
  window.history.replaceState(null, "", `/#/analogue-clock?${query}`);
  const original = window.location.href;
  render(<App />);
  await screen.findByRole("heading", { name: heading });
  expect(window.location.href).toBe(original);
  fireEvent.click(screen.getByRole("link", { name: "Start fresh" }));
  await screen.findByRole("slider", { name: "Hour hand" });
  expect(window.location.hash).toBe("#/analogue-clock");
});

it("advances all three strips after two hour-hand rotations and restores the year position", async () => {
  window.history.replaceState(null, "", "/#/analogue-clock?s=3600");
  const { pointer } = await face();
  pointer("pointerDown", 30, 120);
  for (let angle = 120; angle <= 750; angle += 90) pointer("pointerMove", angle, 120);
  pointer("pointerUp", 750, 120);
  expect(persistedState().seconds).toBe(90000);
  expect(minutes()).toBe(60);
  expect(screen.getByRole("slider", { name: /Day progress: 01:00:00/ })).toBeTruthy();
  expect(screen.getByRole("slider", { name: /Week progress:.*2 January/ })).toBeTruthy();
  expect(screen.getByRole("slider", { name: /Year progress:.*2 January/ })).toBeTruthy();
  const shared = window.location.hash;
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  await screen.findByRole("slider", { name: /Year progress:.*2 January/ });
  expect(window.location.hash).toBe(shared);
  expect(persistedState().seconds).toBe(90000);
});

it("wraps the year in both directions, keeping strips and local clock in sync", async () => {
  window.history.replaceState(null, "", `/#/analogue-clock?s=${currentYear.seconds - 60}`);
  await face();
  const minute = screen.getByRole("slider", { name: "Minute hand" });
  fireEvent.keyDown(minute, { key: "ArrowUp" });
  expect(screen.getByRole("slider", { name: /Day progress: 00:00:00/ })).toBeTruthy();
  expect(screen.getByRole("slider", { name: /Year progress:.*1 January/ })).toBeTruthy();
  expect(
    document.querySelector<HTMLElement>(
      ".analogue-clock-year-strip .analogue-clock-progress-marker",
    )!.style.left,
  ).toBe("0%");
  fireEvent.keyDown(minute, { key: "ArrowDown" });
  expect(screen.getByRole("slider", { name: /Day progress: 23:59:00/ })).toBeTruthy();
  expect(screen.getByRole("slider", { name: /Year progress:.*31 December/ })).toBeTruthy();
  await waitFor(() => expect(persistedState().seconds).toBe(currentYear.seconds - 60));
});

it("accumulates sub-second pointer movements rather than losing slow drags", async () => {
  const { pointer } = await face();
  pointer("pointerDown", 0);
  for (let step = 1; step <= 100; step++) pointer("pointerMove", step * 0.01);
  pointer("pointerUp", 1);
  expect(persistedState().seconds).toBe(10);
});

it("resets week progress on Monday while preserving the year position", async () => {
  const sunday = currentYear.start
    .add({ days: 7 - currentYear.start.dayOfWeek })
    .with({ hour: 23, minute: 59 });
  const seconds = (sunday.epochMilliseconds - currentYear.start.epochMilliseconds) / 1000;
  window.history.replaceState(null, "", `/#/analogue-clock?s=${seconds}`);
  await face();
  const marker = document.querySelector<HTMLElement>(
    ".analogue-clock-week-strip .analogue-clock-progress-marker",
  )!;
  expect(parseFloat(marker.style.left)).toBeGreaterThan(99);
  fireEvent.keyDown(screen.getByRole("slider", { name: "Minute hand" }), { key: "ArrowUp" });
  expect(marker.style.left).toBe("0%");
  expect(screen.getByRole("slider", { name: /Week progress: Monday/ })).toBeTruthy();
  await waitFor(() => expect(persistedState().seconds).toBe(seconds + 60));
});

async function strip(kind: "day" | "week" | "year") {
  await face();
  const target = screen.getByRole("slider", {
    name: new RegExp(`^${kind[0].toUpperCase()}${kind.slice(1)} progress:`),
  });
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, 700, 100));
  const captures = new Set<number>();
  const set = vi.fn((id: number) => captures.add(id));
  const release = vi.fn((id: number) => captures.delete(id));
  Object.defineProperties(target, {
    setPointerCapture: { value: set, configurable: true },
    hasPointerCapture: { value: (id: number) => captures.has(id), configurable: true },
    releasePointerCapture: { value: release, configurable: true },
  });
  const pointer = (
    type: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel" | "lostPointerCapture",
    fraction: number,
    pointerId = 1,
  ) =>
    fireEvent[type](target, {
      pointerId,
      pointerType: "touch",
      button: 0,
      clientX: 10 + fraction * 700,
      clientY: 70,
    });
  return { target, pointer, set, release };
}

it("taps and scrubs the day, ignores extra fingers, and flushes one URL write on release", async () => {
  const { target, pointer, set, release } = await strip("day");
  const replace = vi.spyOn(window.history, "replaceState");
  const length = window.history.length;
  pointer("pointerDown", 0.5);
  expect(minutes()).toBe(0);
  expect(set).toHaveBeenCalledWith(1);
  pointer("pointerDown", 0.1, 2);
  pointer("pointerMove", 0.1, 2);
  expect(minutes()).toBe(0);
  pointer("pointerMove", 0.75);
  expect(minutes()).toBe(360);
  expect(replace).not.toHaveBeenCalled();
  pointer("pointerUp", 0.75);
  expect(persistedState().seconds).toBe(18 * 3600);
  expect(replace).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledWith(1);
  pointer("pointerUp", 0.1, 2);
  expect(target.classList.contains("analogue-clock-strip-dragging")).toBe(false);
  pointer("pointerMove", 0);
  expect(minutes()).toBe(360);
  expect(window.history.length).toBe(length);
});

it("keeps a week scrub anchored when dragging beyond both edges", async () => {
  window.history.replaceState(null, "", "/#/analogue-clock?s=1728000");
  const { pointer } = await strip("week");
  pointer("pointerDown", 0.5);
  const thursday = screen.getByRole("slider", { name: /Week progress: Thursday/ });
  expect(thursday).toBeTruthy();
  pointer("pointerMove", 1.2);
  expect(screen.getByRole("slider", { name: /Week progress: Sunday.*23:59:59/ })).toBeTruthy();
  pointer("pointerMove", -0.2);
  expect(screen.getByRole("slider", { name: /Week progress: Monday.*00:00:00/ })).toBeTruthy();
  pointer("pointerUp", -0.2);
  expect(currentYear.at(persistedState().seconds).dayOfWeek).toBe(1);
});

it.each(["pointerCancel", "lostPointerCapture"] as const)(
  "ends year scrubbing on %s and supports another gesture",
  async (end) => {
    const { pointer, target } = await strip("year");
    pointer("pointerDown", 0.5);
    pointer(end, 0.5);
    expect(target.classList.contains("analogue-clock-strip-dragging")).toBe(false);
    pointer("pointerMove", 0.75);
    expect(Number(target.getAttribute("aria-valuenow"))).toBe(50);
    pointer("pointerDown", 0.75);
    pointer("pointerUp", 1.1);
    expect(persistedState().seconds).toBe(currentYear.seconds - 1);
  },
);

it.each(["pointerUp", "pointerCancel", "lostPointerCapture"] as const)(
  "hides the day marker and minute hand until year drag ends with %s",
  async (end) => {
    const { pointer } = await strip("year");
    const marker = () =>
      document.querySelector(".analogue-clock-day-strip .analogue-clock-progress-marker");
    const selected = 10 * 3600 + 22 * 60 + 17;
    expect(marker()).not.toBeNull();
    pointer("pointerDown", selected / currentYear.seconds);
    expect(marker()).toBeNull();
    expect(minutes()).toBeCloseTo(10 * 60 + 22 + 17 / 60);
    expect(screen.queryByRole("slider", { name: "Minute hand" })).toBeNull();
    expect(
      document.querySelector(".analogue-clock-week-strip .analogue-clock-progress-marker"),
    ).not.toBeNull();
    pointer("pointerMove", (selected + 60) / currentYear.seconds);
    expect(minutes()).toBeCloseTo(10 * 60 + 23 + 17 / 60);
    pointer(end, (selected + 60) / currentYear.seconds);
    expect(marker()).not.toBeNull();
    expect(screen.getByRole("slider", { name: "Minute hand" })).toBeTruthy();
    expect(minutes()).toBeCloseTo(10 * 60 + 23 + 17 / 60);
    await waitFor(() => expect(persistedState().seconds).toBe(selected + 60));
  },
);

it.each([
  ["week", "pointerUp"],
  ["week", "pointerCancel"],
  ["week", "lostPointerCapture"],
  ["year", "pointerUp"],
  ["year", "pointerCancel"],
  ["year", "lostPointerCapture"],
] as const)("shows a daily moon trail only during %s dragging, ending on %s", async (kind, end) => {
  const { pointer } = await strip(kind);
  const trail = () => document.querySelector(".analogue-clock-moon-trail");
  expect(trail()).toBeNull();
  pointer("pointerDown", 0);
  expect(trail()?.querySelectorAll("svg")).toHaveLength(48);
  const firstPosition = trail()?.querySelector("svg")?.getAttribute("style");
  pointer("pointerMove", 0.8);
  expect(trail()?.querySelector("svg")?.getAttribute("style")).not.toBe(firstPosition);
  expect(document.querySelectorAll(".analogue-clock-moon-strip > svg")).toHaveLength(1);
  pointer(end, 0.8);
  expect(trail()).toBeNull();
  expect(document.querySelectorAll(".analogue-clock-moon-strip svg")).toHaveLength(1);
});

it("supports keyboard strip scrubbing", async () => {
  const { target } = await strip("day");
  fireEvent.keyDown(target, { key: "ArrowRight" });
  expect(minutes()).toBe(1);
  fireEvent.keyDown(target, { key: "End" });
  expect(screen.getByRole("slider", { name: /Day progress: 23:59:59/ })).toBeTruthy();
  fireEvent.keyDown(target, { key: "Home" });
  expect(minutes()).toBe(0);
  const year = screen.getByRole("slider", { name: /Year progress:/ });
  fireEvent.keyDown(year, { key: "ArrowRight" });
  await waitFor(() => expect(persistedState().seconds).toBe(86400));
});

it("resets to the current instant at each click while preserving number settings and history", async () => {
  window.history.replaceState(null, "", "/#/analogue-clock?note=keep&s=0&h=0&t=1&m=1");
  const now = vi
    .spyOn(Temporal.Now, "instant")
    .mockReturnValue(
      Temporal.Instant.fromEpochMilliseconds(currentYear.start.epochMilliseconds + 123456000),
    );
  await face();
  const historyLength = window.history.length;
  const reset = screen.getByRole("button", { name: "Reset to now" });
  fireEvent.click(reset);
  await waitFor(() =>
    expect(persistedState()).toEqual({
      v: 2,
      seconds: 123456,
      show12HourNumbers: false,
      show24HourNumbers: true,
      showMinuteNumbers: true,
      sideBySide: false,
      location: { latitude: 51.5074, longitude: -0.1278 },
    }),
  );
  now.mockReturnValue(
    Temporal.Instant.fromEpochMilliseconds(currentYear.start.epochMilliseconds + 123516000),
  );
  fireEvent.click(reset);
  await waitFor(() => expect(persistedState().seconds).toBe(123516));
  expect(window.history.length).toBe(historyLength);
  expect(new URLSearchParams(splitHash(window.location.hash).search).get("note")).toBe("keep");
});

it("restores the layout from links and history, and preserves it through time edits", async () => {
  window.history.replaceState(null, "", "/#/analogue-clock?s=0&b=1");
  await face();
  const layout = screen.getByRole("checkbox", { name: "Side-by-side" }) as HTMLInputElement;
  expect(layout.checked).toBe(true);
  fireEvent.keyDown(screen.getByRole("slider", { name: "Minute hand" }), { key: "ArrowUp" });
  await waitFor(() => expect(persistedState().seconds).toBe(60));
  expect(persistedState().sideBySide).toBe(true);
  fireEvent.click(layout);
  await waitFor(() =>
    expect(new URLSearchParams(splitHash(window.location.hash).search).has("b")).toBe(false),
  );
  fireEvent.click(layout);
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  expect(
    ((await screen.findByRole("checkbox", { name: "Side-by-side" })) as HTMLInputElement).checked,
  ).toBe(true);
  expect(persistedState().sideBySide).toBe(true);
});

it("opens the shared picker, selects a city and restores the location through links and history", async () => {
  const cities = cityFunctions.decodeCities([
    ["London", "GB", "London", 51.5074, -0.1278],
    ["Sydney", "AU", "New South Wales", -33.8688, 151.2093],
  ]);
  vi.spyOn(cityFunctions, "loadCities").mockResolvedValue(cities);
  await face();
  await screen.findByText(/^London ·/);
  const day = screen.getByRole("slider", { name: /Day progress:/ });
  const originalGradient = day.getAttribute("style");
  const moon = document.querySelector(".analogue-clock-moon-strip")!.getAttribute("aria-label");
  const originalUrl = window.location.href;
  const length = window.history.length;
  const gear = screen.getByRole("button", { name: "Choose location" });
  expect(gear.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(gear);
  expect(window.location.href).toBe(originalUrl);
  expect(screen.queryByRole("heading", { name: "Location picker" })).toBeNull();
  fireEvent.click(
    await screen.findByRole("button", { name: "Select Sydney, Australia, New South Wales" }),
  );
  await waitFor(() =>
    expect(persistedState().location).toEqual({ latitude: -33.8688, longitude: 151.2093 }),
  );
  expect(screen.getByText(/^Sydney ·/)).toBeTruthy();
  expect(day.getAttribute("style")).not.toBe(originalGradient);
  expect(document.querySelector(".analogue-clock-moon-strip")!.getAttribute("aria-label")).not.toBe(
    moon,
  );
  expect(persistedState().seconds).toBe(0);
  expect(window.history.length).toBe(length);
  expect(window.location.hash).toContain("note=keep");
  fireEvent.click(gear);
  expect(screen.queryByRole("spinbutton", { name: "Latitude (−90 to 90)" })).toBeNull();
  const shared = window.location.hash;
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  await screen.findByText(/^Sydney ·/);
  expect(window.location.hash).toBe(shared);
  fireEvent.click(screen.getByRole("button", { name: "Choose location" }));
  expect(
    (screen.getByRole("spinbutton", { name: "Latitude (−90 to 90)" }) as HTMLInputElement).value,
  ).toBe("-33.8688");
  window.location.hash = "/analogue-clock?s=0&lat=90&lon=0";
  await waitFor(() =>
    expect(
      (screen.getByRole("spinbutton", { name: "Latitude (−90 to 90)" }) as HTMLInputElement).value,
    ).toBe("90"),
  );
  expect(screen.getByRole("slider", { name: /Day progress:.*Sunrise unavailable/ })).toBeTruthy();
});

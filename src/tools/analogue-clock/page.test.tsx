// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../app.tsx";
import { navigateHash, splitHash } from "../../boot/hash-location.ts";
import { packState } from "../../boot/url-state.ts";
import { pointOnClock } from "./clock.ts";
import { analogueClockCodec } from "./state.ts";

beforeEach(() =>
  window.history.replaceState(
    null,
    "",
    `/#/analogue-clock?note=keep&s=${packState({ v: 1, minutes: 0 })}`,
  ),
);
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
    v: 1,
    minutes: 5,
    show12HourNumbers: false,
    show24HourNumbers: true,
    showMinuteNumbers: true,
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
  expect(persistedState().minutes).toBe(0);
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  await screen.findByRole("slider", { name: "Minute hand" });
  expect(minutes()).toBe(1);
  expect(persistedState().minutes).toBe(1);
});

it("incoming same-tool links cancel pending edits rather than being overwritten", async () => {
  await face();
  fireEvent.keyDown(screen.getByRole("slider", { name: "Minute hand" }), { key: "ArrowUp" });
  expect(minutes()).toBe(1);
  act(() => navigateHash("/analogue-clock?minutes=90&hours24=1", { replace: true }));
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
  expect(window.location.hash).toBe("#/analogue-clock?note=keep&minutes=60");
  expect(persistedState().minutes).toBeCloseTo(60);
});

it("drags the hour hand, including backwards across twelve", async () => {
  window.history.replaceState(null, "", `/#/analogue-clock?s=${packState({ v: 1, minutes: 60 })}`);
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
  window.history.replaceState(null, "", `/#/analogue-clock?s=${packState({ v: 1, minutes: 60 })}`);
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
  window.history.replaceState(null, "", `/#/analogue-clock?s=${packState({ v: 1, minutes: 180 })}`);
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
  await waitFor(() => expect(persistedState().minutes).toBe(64));
  const shared = window.location.hash;
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  await screen.findByRole("slider", { name: "Minute hand" });
  expect(window.location.hash).toBe(shared);
  expect(screen.getByRole("slider", { name: "Hour hand" }).getAttribute("aria-valuetext")).toBe(
    "1 hours, 4 minutes",
  );
  window.location.hash = `/analogue-clock?s=${packState({ v: 1, minutes: 90 })}`;
  await waitFor(() =>
    expect(screen.getByRole("slider", { name: "Hour hand" }).getAttribute("aria-valuenow")).toBe(
      "1.5",
    ),
  );
});

it.each([
  [{ v: 1, minutes: 720 }, "Corrupt URL state"],
  [{ v: 2, minutes: 0 }, "Unrecognised state version"],
])("preserves invalid links and offers recovery", async (state, heading) => {
  window.history.replaceState(null, "", `/#/analogue-clock?s=${packState(state)}`);
  const original = window.location.href;
  render(<App />);
  await screen.findByRole("heading", { name: String(heading) });
  expect(window.location.href).toBe(original);
  fireEvent.click(screen.getByRole("link", { name: "Start fresh" }));
  await screen.findByRole("slider", { name: "Hour hand" });
  expect(window.location.hash).toBe("#/analogue-clock");
});

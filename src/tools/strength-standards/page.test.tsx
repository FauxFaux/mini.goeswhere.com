// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it } from "vitest";
import { App } from "../../app.tsx";
import { navigateHash, splitHash } from "../../boot/hash-location.ts";
import { packState, unpackState } from "../../boot/url-state.ts";

beforeEach(() => window.history.replaceState(null, "", "/#/strength-standards?note=keep"));
afterEach(cleanup);

it("defaults to men/kg and persists both toggles without adding history entries", async () => {
  const user = userEvent.setup();
  const historyLength = window.history.length;
  render(<App />);
  const men = await screen.findByRole("radio", { name: "Men" });
  expect((men as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("radio", { name: "Kilograms (kg)" }) as HTMLInputElement).checked).toBe(
    true,
  );
  const press = screen.getByRole("table", { name: "Press — Adult men (kg)" });
  expect(within(press).getByRole("row", { name: "74.8 34.0 46.3 58.5 69.4 84.4" })).toBeTruthy();
  expect(within(press).getByRole("rowheader", { name: "145.1+" })).toBeTruthy();
  expect(window.location.hash).toBe("#/strength-standards?note=keep");
  await user.click(screen.getByRole("radio", { name: "Women" }));
  await user.click(screen.getByRole("radio", { name: "Pounds (lb)" }));
  const womenPress = screen.getByRole("table", { name: "Press — Adult women (lb)" });
  expect(within(womenPress).getByRole("row", { name: "165 48 65 77 102 134" })).toBeTruthy();
  expect(within(womenPress).getByRole("rowheader", { name: "199+" })).toBeTruthy();
  const params = new URLSearchParams(splitHash(window.location.hash).search);
  expect(unpackState(params.get("s")!)).toEqual({ v: 1, sex: "women", unit: "lb" });
  expect(params.get("note")).toBe("keep");
  expect(window.history.length).toBe(historyLength);
});

it("restores shared choices, external hash changes, and history navigation", async () => {
  const shared = { v: 1, sex: "women", unit: "lb" };
  window.history.replaceState(null, "", `/#/strength-standards?s=${packState(shared)}`);
  const original = window.location.href;
  render(<App />);
  await screen.findByRole("table", { name: "Press — Adult women (lb)" });
  expect(window.location.href).toBe(original);
  window.location.hash = `/strength-standards?s=${packState({ ...shared, sex: "men" })}`;
  await screen.findByRole("table", { name: "Press — Adult men (lb)" });
  act(() => navigateHash("/hello-world"));
  await screen.findByRole("textbox", { name: "Your name" });
  window.history.back();
  await screen.findByRole("table", { name: "Press — Adult men (lb)" });
  window.history.forward();
  await screen.findByRole("textbox", { name: "Your name" });
});

it("preserves corrupt links and offers recovery", async () => {
  const user = userEvent.setup();
  window.history.replaceState(
    null,
    "",
    `/#/strength-standards?s=${packState({ v: 1, unit: "bad" })}`,
  );
  const original = window.location.href;
  render(<App />);
  await screen.findByRole("heading", { name: "Corrupt URL state" });
  expect(window.location.href).toBe(original);
  await user.click(screen.getByRole("link", { name: "Start fresh" }));
  await waitFor(() => expect(screen.getAllByRole("table")).toHaveLength(5));
  expect(window.location.hash).toBe("#/strength-standards");
});

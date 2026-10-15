// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Flash } from "./page.tsx";
import { STORAGE_KEY } from "./model.ts";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Secret deck",
        cards: [
          { id: "a", front: "Question A", back: "Answer A" },
          { id: "b", front: "Question B", back: "Answer B" },
        ],
      }),
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("creates a local profile, reveals and records a keyboard rating, then resumes", async () => {
  const view = render(<Flash />);
  fireEvent.input(screen.getByLabelText("Profile name"), { target: { value: "Me" } });
  fireEvent.input(screen.getByLabelText("Deck identifier"), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText("Question A");
  expect(fetch).toHaveBeenCalledWith("/flash/secret.json", expect.anything());
  expect(screen.queryByText("Answer A")).toBeNull();
  fireEvent.keyDown(window, { key: "4" });
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).reviews).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
  await screen.findByText("Answer A");
  fireEvent.keyDown(window, { key: "3" });
  await screen.findByText("Question B");
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  expect(saved.reviews[0]).toMatchObject({ deck: "secret", card: "a", rating: 3 });
  expect(saved.reviews[0].ratedAt).toBeGreaterThanOrEqual(saved.reviews[0].shownAt);
  view.unmount();
  render(<Flash />);
  await screen.findByText("Question B");
});

it("preserves corrupt storage and offers explicit replacement", () => {
  localStorage.setItem(STORAGE_KEY, "broken");
  render(<Flash />);
  expect(screen.getByRole("alert").textContent).toContain("preserved");
  expect(localStorage.getItem(STORAGE_KEY)).toBe("broken");
  expect(screen.getByRole("button", { name: "Replace local profile" })).toBeTruthy();
});

it("keeps the current card when writing the review fails", async () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ v: 1, name: "Me", deck: "secret", reviews: [] }),
  );
  render(<Flash />);
  await screen.findByText("Question A");
  fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
  const storage = localStorage;
  vi.stubGlobal("localStorage", {
    getItem: storage.getItem.bind(storage),
    setItem: () => {
      throw new Error("Full");
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "1 · Again" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Could not save"));
  expect(screen.getByText("Answer A")).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).reviews).toHaveLength(0);
});

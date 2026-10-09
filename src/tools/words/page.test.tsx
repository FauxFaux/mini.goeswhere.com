// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { useMiniLocation, useMiniSearch } from "../../boot/hash-location.ts";
import { Words } from "./page.tsx";

vi.mock("./dictionary.ts", () => ({ loadDictionary: vi.fn(async () => ["cat", "dog"]) }));

afterEach(cleanup);

it("keeps previous matches dimmed while pending and replaces them when ready", async () => {
  window.history.replaceState(null, "", "/#/words?q=cat");
  render(
    <Router hook={useMiniLocation} searchHook={useMiniSearch}>
      <Words />
    </Router>,
  );
  await waitFor(() => expect(screen.getByRole("listitem").textContent).toBe("cat"));
  expect(screen.getByRole("status").textContent).toBe("One match.");
  const results = screen.getByRole("status").parentElement!;
  expect(results.getAttribute("aria-busy")).toBe("false");
  fireEvent.input(screen.getByRole("textbox", { name: "Regular expression" }), {
    target: { value: "dog" },
  });
  expect(screen.getByRole("listitem").textContent).toBe("cat");
  expect(results.getAttribute("aria-busy")).toBe("true");
  expect(screen.queryByText("Loading dictionary and searching…")).toBeNull();
  await waitFor(() => expect(screen.getByRole("listitem").textContent).toBe("dog"));
  expect(results.getAttribute("aria-busy")).toBe("false");
  fireEvent.input(screen.getByRole("textbox", { name: "Regular expression" }), {
    target: { value: "[" },
  });
  expect(screen.getByRole("listitem").textContent).toBe("dog");
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy());
  expect(screen.queryByRole("listitem")).toBeNull();
  expect(results.getAttribute("aria-busy")).toBe("false");
  fireEvent.input(screen.getByRole("textbox", { name: "Regular expression" }), {
    target: { value: "" },
  });
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Two matches."));
  fireEvent.input(screen.getByRole("textbox", { name: "Regular expression" }), {
    target: { value: "^nothing$" },
  });
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Zero matches."));
});

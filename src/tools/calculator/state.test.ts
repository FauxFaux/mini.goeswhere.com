import { describe, expect, it } from "vitest";
import { packState, readState } from "../../boot/url-state.ts";
import { calculatorCodec, MAX_UNIT_FILTER_LENGTH } from "./state.ts";

describe("calculator unit filter URL state", () => {
  it("accepts old links and round-trips optional Unicode filters", () => {
    for (const state of [
      { v: 1, tiles: [] },
      { v: 1, tiles: [], unitFilter: "" },
      { v: 1, tiles: [], unitFilter: "Ångström" },
      { v: 1, tiles: [], unitFilter: "a".repeat(MAX_UNIT_FILTER_LENGTH) },
    ]) {
      expect(readState(packState(state), calculatorCodec)).toEqual({ kind: "ok", state });
    }
  });

  it.each([null, 1, [], {}, "a".repeat(MAX_UNIT_FILTER_LENGTH + 1)])(
    "rejects malformed or oversized filters: %j",
    (unitFilter) => {
      expect(readState(packState({ v: 1, tiles: [], unitFilter }), calculatorCodec).kind).toBe(
        "unpack-error",
      );
    },
  );
});

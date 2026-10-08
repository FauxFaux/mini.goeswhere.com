import { isRecord, UnsupportedStateVersion, type UrlCodec } from "../../boot/url-state.ts";

export interface CalculatorState {
  v: 1;
  /** Stable tile identities keep focus when other tiles are removed. */
  tiles: { id: string; expression: string }[];
  unitFilter?: string;
}

export const MAX_TILES = 48;
export const MAX_EXPRESSION_LENGTH = 1000;
export const MAX_UNIT_FILTER_LENGTH = 256;

// IDs are UI identities, not shareable inputs. Keep the latest written identities
// while editing; a fresh shared link gets deterministic identities in URL order.
let latestQuery: { key: string; state: CalculatorState } | undefined;
const queryKey = (params: URLSearchParams) =>
  JSON.stringify([params.getAll("e"), params.get("empty")]);

export const calculatorCodec: UrlCodec<CalculatorState> = {
  defaultState: {
    v: 1,
    tiles: [{ id: "arithmetic", expression: "(12 + 8) * 3" }],
  },
  query: {
    decode(params) {
      if (params.getAll("q").length > 1 || params.getAll("empty").length > 1) {
        throw new Error("Duplicate calculator state or search parameter.");
      }
      const key = queryKey(params);
      if (params.has("empty") && (params.get("empty") !== "1" || params.has("e"))) {
        throw new Error("Invalid empty calculator state.");
      }
      const expressions = params.getAll("e");
      // e parameters preserve blank expressions; e omitted with q present can
      // still mean the default expressions. A separate empty marker stores zero tiles.
      const tiles = params.has("empty")
        ? []
        : !params.has("e")
          ? calculatorCodec.defaultState.tiles
          : expressions.map((expression, index) => ({ id: `expression-${index}`, expression }));
      return calculatorCodec.decode({
        v: 1,
        tiles: latestQuery?.key === key ? latestQuery.state.tiles : tiles,
        ...(params.has("q") ? { unitFilter: params.get("q") } : {}),
      });
    },
    write(params, state) {
      params.delete("s");
      params.delete("e");
      for (const tile of state.tiles) params.append("e", tile.expression);
      if (!state.tiles.length) params.set("empty", "1");
      else params.delete("empty");
      if (state.unitFilter) params.set("q", state.unitFilter);
      else params.delete("q");
      latestQuery = { key: queryKey(params), state };
    },
  },
  decode(value) {
    if (!isRecord(value)) throw new Error("Calculator state must be an object.");
    if (value.v !== 1) throw new UnsupportedStateVersion();
    if (
      value.unitFilter !== undefined &&
      (typeof value.unitFilter !== "string" || value.unitFilter.length > MAX_UNIT_FILTER_LENGTH)
    ) {
      throw new Error(`Unit filter must be text of at most ${MAX_UNIT_FILTER_LENGTH} characters.`);
    }
    if (!Array.isArray(value.tiles) || value.tiles.length > MAX_TILES) {
      throw new Error(`Calculator state must contain at most ${MAX_TILES} tiles.`);
    }
    const ids = new Set<string>();
    const tiles = value.tiles.map((tile: unknown) => {
      if (
        !isRecord(tile) ||
        typeof tile.id !== "string" ||
        !tile.id ||
        tile.id.length > 100 ||
        ids.has(tile.id) ||
        typeof tile.expression !== "string" ||
        tile.expression.length > MAX_EXPRESSION_LENGTH
      ) {
        throw new Error("Calculator state contains an invalid or duplicate tile.");
      }
      ids.add(tile.id);
      return { id: tile.id, expression: tile.expression };
    });
    return {
      v: 1,
      tiles,
      ...(value.unitFilter !== undefined ? { unitFilter: value.unitFilter } : {}),
    };
  },
};

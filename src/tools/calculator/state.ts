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

export const calculatorCodec: UrlCodec<CalculatorState> = {
  defaultState: {
    v: 1,
    tiles: [
      { id: "arithmetic", expression: "(12 + 8) * 3" },
      { id: "powers", expression: "2 ^ 10" },
      { id: "functions", expression: "sqrt(144) + max(3, 7)" },
      { id: "circle", expression: "pi * 5 ^ 2" },
    ],
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

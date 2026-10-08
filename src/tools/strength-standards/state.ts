import {
  isRecord,
  unpackState,
  UnsupportedStateVersion,
  type UrlCodec,
} from "../../boot/url-state.ts";
import { POUNDS_TO_KG } from "./standards.ts";

export interface StrengthStandardsState {
  v: 1;
  sex: "men" | "women";
  unit: "kg" | "lb";
  performance?: "1rm" | "5x5";
  /** Bodyweight in pounds, independent of the display unit. */
  weight?: number;
  /** Selected graph category, including fractional values between 0 and 5. */
  graphCategory?: number;
}

export const strengthStandardsCodec: UrlCodec<StrengthStandardsState> = {
  defaultState: { v: 1, sex: "men", unit: "kg", weight: 75 / POUNDS_TO_KG, graphCategory: 1 },
  query: {
    decode(params) {
      for (const key of ["s", "u", "w", "c", "p"]) {
        if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key} parameter.`);
      }
      const sex = params.get("s");
      if (
        sex !== null &&
        sex !== "m" &&
        sex !== "f" &&
        !["u", "w", "c", "p"].some((key) => params.has(key))
      ) {
        return strengthStandardsCodec.decode(unpackState(sex));
      }
      if (sex !== null && sex !== "m" && sex !== "f")
        throw new Error("Invalid strength standards sex.");
      const unit = params.get("u");
      if (unit !== null && unit !== "k" && unit !== "l")
        throw new Error("Invalid strength standards unit.");
      const factor = unit === "l" ? 1 : POUNDS_TO_KG;
      const number = (key: string, fallback: number) => {
        const value = params.get(key);
        if (value === null) return fallback;
        if (value === "") return undefined;
        if (
          value.length > 32 ||
          !/^-?\d+(?:\.\d+)?$/.test(value) ||
          !Number.isFinite(Number(value))
        ) {
          throw new Error(`Invalid ${key} parameter.`);
        }
        return Number(value);
      };
      const weight = number("w", (75 / POUNDS_TO_KG) * factor);
      return strengthStandardsCodec.decode({
        v: 1,
        sex: sex === "f" ? "women" : "men",
        unit: unit === "l" ? "lb" : "kg",
        weight: weight === undefined ? undefined : weight / factor,
        graphCategory: number("c", 1),
        ...(params.has("p") ? { performance: params.get("p") } : {}),
      });
    },
    write(params, state) {
      const round = (value: number, dp: number) => String(Number(value.toFixed(dp)));
      params.set("s", state.sex === "men" ? "m" : "f");
      params.set(
        "w",
        state.weight === undefined
          ? ""
          : round(state.weight * (state.unit === "kg" ? POUNDS_TO_KG : 1), 1),
      );
      params.set("c", state.graphCategory === undefined ? "" : round(state.graphCategory, 3));
      if (state.performance === "5x5") params.set("p", "5x5");
      else params.delete("p");
      if (state.unit === "lb") params.set("u", "l");
      else params.delete("u");
    },
  },
  decode(value) {
    if (!isRecord(value)) throw new Error("Strength standards state must be an object.");
    if (value.v !== 1) throw new UnsupportedStateVersion();
    const sex = value.sex === undefined ? "men" : value.sex;
    const unit = value.unit === undefined ? "kg" : value.unit;
    if (sex !== "men" && sex !== "women") throw new Error("Invalid strength standards sex.");
    if (unit !== "kg" && unit !== "lb") throw new Error("Invalid strength standards unit.");
    if (
      value.weight !== undefined &&
      (typeof value.weight !== "number" || !Number.isFinite(value.weight))
    ) {
      throw new Error("Bodyweight must be a finite number.");
    }
    if (
      value.graphCategory !== undefined &&
      (typeof value.graphCategory !== "number" ||
        !Number.isFinite(value.graphCategory) ||
        value.graphCategory < 0 ||
        value.graphCategory > 5)
    ) {
      throw new Error("Graph category must be a finite number between 0 and 5.");
    }
    if (
      value.performance !== undefined &&
      value.performance !== "1rm" &&
      value.performance !== "5x5"
    ) {
      throw new Error("Invalid strength standards performance.");
    }
    return {
      v: 1,
      sex,
      unit,
      ...(value.performance === undefined ? {} : { performance: value.performance }),
      ...(value.weight === undefined ? {} : { weight: value.weight }),
      ...(value.graphCategory === undefined ? {} : { graphCategory: value.graphCategory }),
    };
  },
};

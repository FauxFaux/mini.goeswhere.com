import { isRecord, UnsupportedStateVersion, type UrlCodec } from "../../boot/url-state.ts";
import { POUNDS_TO_KG } from "./standards.ts";

export interface StrengthStandardsState {
  v: 1;
  sex: "men" | "women";
  unit: "kg" | "lb";
  /** Bodyweight in pounds, independent of the display unit. */
  weight?: number;
  /** Selected graph category, including fractional values between 0 and 5. */
  graphCategory?: number;
}

export const strengthStandardsCodec: UrlCodec<StrengthStandardsState> = {
  defaultState: { v: 1, sex: "men", unit: "kg", weight: 75 / POUNDS_TO_KG, graphCategory: 1 },
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
    return {
      v: 1,
      sex,
      unit,
      ...(value.weight === undefined ? {} : { weight: value.weight }),
      ...(value.graphCategory === undefined ? {} : { graphCategory: value.graphCategory }),
    };
  },
};

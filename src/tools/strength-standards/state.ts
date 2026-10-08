import { isRecord, UnsupportedStateVersion, type UrlCodec } from "../../boot/url-state.ts";

export interface StrengthStandardsState {
  v: 1;
  sex: "men" | "women";
  unit: "kg" | "lb";
  /** Bodyweight in pounds, independent of the display unit. Omitted for full tables. */
  weight?: number;
}

export const strengthStandardsCodec: UrlCodec<StrengthStandardsState> = {
  defaultState: { v: 1, sex: "men", unit: "kg" },
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
    return { v: 1, sex, unit, ...(value.weight === undefined ? {} : { weight: value.weight }) };
  },
};

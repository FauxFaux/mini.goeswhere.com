import { isRecord, UnsupportedStateVersion, type UrlCodec } from "../../boot/url-state.ts";

export interface StrengthStandardsState {
  v: 1;
  sex: "men" | "women";
  unit: "kg" | "lb";
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
    return { v: 1, sex, unit };
  },
};

import {
  isRecord,
  unpackState,
  UnsupportedStateVersion,
  type UrlCodec,
} from "../../boot/url-state.ts";
import { electricConsumptionConversion } from "./costs.ts";

export interface FuelElectricState {
  v: 1;
  chargingPence: number;
  petrolPence: number;
  mpg: number;
  petrolUnit: "mpg" | "litres";
  kwhPer100km: number;
  electricUnit: "kwh" | "miles";
  annualKm: number;
}

export const limits = {
  chargingPence: [6, 90],
  petrolPence: [50, 300],
  mpg: [30, 60],
  kwhPer100km: [12, 30],
  annualKm: [0, 20_000],
} as const;

// Numeric values keep their canonical units regardless of the display pickers.
const numericParams = {
  chargingPence: "c",
  petrolPence: "p",
  mpg: "m",
  kwhPer100km: "e",
  annualKm: "d",
} as const;
const urlDecimalPlaces = {
  chargingPence: 2,
  petrolPence: 2,
  mpg: 2,
  kwhPer100km: 2,
  annualKm: 0,
} as const;
const ownedParams = ["v", "s", "u", "t", ...Object.values(numericParams)];

export const fuelElectricCodec: UrlCodec<FuelElectricState> = {
  defaultState: {
    v: 1,
    chargingPence: 6,
    petrolPence: 175,
    mpg: 45,
    petrolUnit: "mpg",
    kwhPer100km: electricConsumptionConversion(4.4),
    electricUnit: "miles",
    annualKm: 10_000,
  },
  decode(value) {
    if (!isRecord(value)) throw new Error("Price comparison state must be an object.");
    if (value.v !== 1) throw new UnsupportedStateVersion();
    const state = { ...fuelElectricCodec.defaultState };
    // Existing links predate the picker and displayed kWh/100 km.
    state.electricUnit = "kwh";
    if (value.electricUnit !== undefined) {
      if (value.electricUnit !== "kwh" && value.electricUnit !== "miles")
        throw new Error("Invalid electric consumption unit.");
      state.electricUnit = value.electricUnit;
    }
    for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
      const input = value[key] === undefined ? state[key] : value[key];
      const [min, max] = limits[key];
      if (typeof input !== "number" || !Number.isFinite(input) || input < min || input > max)
        throw new Error(`Invalid ${key}: choose a number between ${min} and ${max}.`);
      state[key] = input;
    }
    if (value.petrolUnit !== undefined) {
      if (value.petrolUnit !== "mpg" && value.petrolUnit !== "litres")
        throw new Error("Invalid petrol efficiency unit.");
      state.petrolUnit = value.petrolUnit;
    }
    return state;
  },
  query: {
    decode(params) {
      for (const key of ownedParams) {
        if (params.getAll(key).length > 1) throw new Error(`Duplicate ${key} parameter.`);
      }
      if (params.has("v") && params.get("v") !== "1") throw new UnsupportedStateVersion();
      if (params.has("s")) {
        if (ownedParams.some((key) => key !== "s" && params.has(key)))
          throw new Error("Use either legacy saved state or query parameters, not both.");
        return fuelElectricCodec.decode(unpackState(params.get("s")!));
      }
      const state = { ...fuelElectricCodec.defaultState };
      for (const key of Object.keys(numericParams) as (keyof typeof numericParams)[]) {
        const raw = params.get(numericParams[key]);
        if (raw === null) continue;
        if (raw.length > 32 || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))
          throw new Error(`Invalid ${numericParams[key]} number.`);
        state[key] = Number(raw);
      }
      return fuelElectricCodec.decode({
        ...state,
        petrolUnit: params.get("u") ?? state.petrolUnit,
        electricUnit: params.get("t") ?? state.electricUnit,
      });
    },
    write(params, state) {
      for (const key of ownedParams) params.delete(key);
      params.set("v", "1");
      for (const key of Object.keys(numericParams) as (keyof typeof numericParams)[])
        params.set(numericParams[key], String(Number(state[key].toFixed(urlDecimalPlaces[key]))));
      params.set("u", state.petrolUnit);
      params.set("t", state.electricUnit);
    },
  },
};

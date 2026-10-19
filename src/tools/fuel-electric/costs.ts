import type { FuelElectricState } from "./state.ts";

// Imperial gallon = 4.54609 litres; mile = 1.609344 km (exact).
export const mpgConversion = (100 * 4.54609) / 1.609344;
export const litresPer100km = (mpg: number) => mpgConversion / mpg;
// The reciprocal conversion works in both directions.
export const electricConsumptionConversion = (value: number) => 100 / (1.609344 * value);

export function compareCosts(state: FuelElectricState) {
  const litres = litresPer100km(state.mpg);
  const petrolPer100km = (litres * state.petrolPence) / 100;
  const electricPer100km = (state.kwhPer100km * state.chargingPence) / 100;
  const petrolAnnual = (petrolPer100km * state.annualKm) / 100;
  const electricAnnual = (electricPer100km * state.annualKm) / 100;
  return {
    petrolPer100km,
    electricPer100km,
    petrolAnnual,
    electricAnnual,
    annualSaving: petrolAnnual - electricAnnual,
    breakEvenPence: (litres * state.petrolPence) / state.kwhPer100km,
  };
}

import { describe, expect, it } from "vitest";
import { compareCosts, electricConsumptionConversion, litresPer100km } from "./costs.ts";
import { fuelElectricCodec } from "./state.ts";

describe("driving energy costs", () => {
  it("uses imperial mpg and converts litres and pence into annual pounds", () => {
    expect(litresPer100km(30)).toBeCloseTo(9.4160312);
    expect(litresPer100km(60)).toBeCloseTo(4.7080156);
    const costs = compareCosts({
      ...fuelElectricCodec.defaultState,
      petrolPence: 145,
      kwhPer100km: 18,
    });
    expect(costs.electricPer100km).toBeCloseTo(1.08);
    expect(costs.electricAnnual).toBeCloseTo(108);
    expect(costs.petrolAnnual).toBeCloseTo(910.21635);
    expect(costs.annualSaving).toBeCloseTo(802.21635);
  });
  it("converts the 4.4 mi/kWh default without rounding consumption", () => {
    expect(electricConsumptionConversion(4.4)).toBeCloseTo(14.121);
    expect(electricConsumptionConversion(electricConsumptionConversion(4.4))).toBeCloseTo(4.4);
    expect(fuelElectricCodec.defaultState.kwhPer100km).toBe(electricConsumptionConversion(4.4));
    expect(compareCosts(fuelElectricCodec.defaultState).electricAnnual).toBeCloseTo(84.7324);
  });
  it("handles no driving, expensive charging, and break-even", () => {
    const state = fuelElectricCodec.defaultState;
    expect(compareCosts({ ...state, annualKm: 0 }).annualSaving).toBe(0);
    expect(compareCosts({ ...state, chargingPence: 80 }).annualSaving).toBeLessThan(0);
    const { breakEvenPence } = compareCosts(state);
    expect(compareCosts({ ...state, chargingPence: breakEvenPence }).annualSaving).toBeCloseTo(0);
  });
});

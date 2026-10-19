import { UrlHandler } from "../../boot/url-handler.tsx";
import type { State } from "../../boot/url-state.ts";
import {
  compareCosts,
  electricConsumptionConversion,
  litresPer100km,
  mpgConversion,
} from "./costs.ts";
import { fuelElectricCodec, limits, type FuelElectricState } from "./state.ts";
import "./style.css";

const money = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);

export function FuelElectric() {
  return (
    <UrlHandler codec={fuelElectricCodec} debounceMs={150}>
      {(uss) => <Comparison uss={uss} />}
    </UrlHandler>
  );
}

function Comparison({ uss: [state, setState] }: { uss: State<FuelElectricState> }) {
  const costs = compareCosts(state);
  const metric = state.petrolUnit === "litres";
  const electricMiles = state.electricUnit === "miles";
  function example(key: keyof typeof limits, value: number, text: string) {
    return (
      <button
        type="button"
        class="fuel-electric-example"
        onClick={() => setState((previous) => ({ ...previous, [key]: value }))}
      >
        {text}
      </button>
    );
  }
  function slider(key: keyof typeof limits, label: string, unit: string, step: number) {
    const [min, max] = limits[key];
    return (
      <label class="fuel-electric-control">
        <span>
          {label}:{" "}
          <strong>
            {state[key].toLocaleString("en-GB", { maximumFractionDigits: 2 })} {unit}
          </strong>
        </span>
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={state[key]}
          onInput={(event) => {
            const value = event.currentTarget.valueAsNumber;
            setState((previous) => ({ ...previous, [key]: value }));
          }}
        />
        <span class="fuel-electric-endpoints muted">
          <span>
            {min.toLocaleString("en-GB")}
            {unit}
          </span>
          <span>
            {max.toLocaleString("en-GB")}
            {unit}
          </span>
        </span>
      </label>
    );
  }
  return (
    <div class="fuel-electric">
      <h1>Legacy vs electric costs</h1>
      <div class="fuel-electric-inputs">
        <section aria-label="Electric car inputs">
          <h2>Electric</h2>
          {slider("chargingPence", "Charging price", "p/kWh", 0.5)}
          <p class="muted">
            e.g. {example("chargingPence", 7, "7p/kWh")} overnight home deal,{" "}
            {example("chargingPence", 26, "26p/kWh")} regular home,{" "}
            {example("chargingPence", 50, "50p/kWh")} town,{" "}
            {example("chargingPence", 80, "80p/kWh")} motorway.
          </p>
          <div class="fuel-electric-control">
            <div class="fuel-electric-unit">
              Electric consumption:{" "}
              <strong>
                {(electricMiles
                  ? electricConsumptionConversion(state.kwhPer100km)
                  : state.kwhPer100km
                ).toFixed(1)}{" "}
              </strong>
              <select
                aria-label="Electric consumption unit"
                value={state.electricUnit}
                onChange={(event) => {
                  const electricUnit = event.currentTarget.value === "miles" ? "miles" : "kwh";
                  setState((previous) => ({ ...previous, electricUnit }));
                }}
              >
                <option value="miles">mi/kWh</option>
                <option value="kwh">kWh/100 km</option>
              </select>
            </div>
            <input
              type="range"
              aria-label="Electric consumption"
              min={electricMiles ? electricConsumptionConversion(30) : 12}
              max={electricMiles ? electricConsumptionConversion(12) : 30}
              step="any"
              value={
                electricMiles ? electricConsumptionConversion(state.kwhPer100km) : state.kwhPer100km
              }
              onInput={(event) => {
                const value = event.currentTarget.valueAsNumber;
                const kwhPer100km = Math.max(
                  12,
                  Math.min(30, electricMiles ? electricConsumptionConversion(value) : value),
                );
                setState((previous) => ({ ...previous, kwhPer100km }));
              }}
            />
            <span class="muted">12–30 kWh/100 km ≈ 5.2–2.1 mi/kWh</span>
          </div>
          <p class="muted">
            e.g. {example("kwhPer100km", electricConsumptionConversion(4.4), "4.4 mi/kWh")} for{" "}
            <a href="https://www.carwow.co.uk/citroen/e-c5-aircross">Citroën e-C5 Aircross</a>.
          </p>
        </section>
        <section aria-label="Petrol car inputs">
          <h2>Petrol</h2>
          {slider("petrolPence", "Petrol price", "p/litre", 0.5)}
          <p class="muted">
            e.g. {example("petrolPence", 175, "175p/l")} for SE England, Oct 2026.{" "}
            <a href="https://petrolprices.co.uk/">PetrolPrices</a>.
          </p>
          <div class="fuel-electric-control">
            <div class="fuel-electric-unit">
              Petrol efficiency:{" "}
              <strong>{(metric ? litresPer100km(state.mpg) : state.mpg).toFixed(1)} </strong>
              <select
                aria-label="Efficiency unit"
                value={state.petrolUnit}
                onChange={(event) => {
                  const petrolUnit = event.currentTarget.value === "litres" ? "litres" : "mpg";
                  setState((previous) => ({ ...previous, petrolUnit }));
                }}
              >
                <option value="mpg">mpg (UK imperial)</option>
                <option value="litres">l/100 km</option>
              </select>
            </div>
            <input
              type="range"
              aria-label="Petrol efficiency"
              min={metric ? litresPer100km(limits.mpg[1]) : limits.mpg[0]}
              max={metric ? litresPer100km(limits.mpg[0]) : limits.mpg[1]}
              step="any"
              value={metric ? litresPer100km(state.mpg) : state.mpg}
              onInput={(event) => {
                const value = event.currentTarget.valueAsNumber;
                const mpg = Math.max(
                  limits.mpg[0],
                  Math.min(limits.mpg[1], metric ? mpgConversion / value : value),
                );
                setState((previous) => ({ ...previous, mpg }));
              }}
            />
            <span class="muted">
              {limits.mpg[0]}–{limits.mpg[1]} UK mpg ≈ {litresPer100km(limits.mpg[0]).toFixed(1)}–
              {litresPer100km(limits.mpg[1]).toFixed(1)} l/100 km
            </span>
          </div>
          <p class="muted">
            e.g. {example("mpg", 45, "45 UK mpg")} for{" "}
            <a href="https://www.carwow.co.uk/citroen/c5-aircross">Citroën C5 Aircross</a>.
          </p>
        </section>
      </div>
      <section aria-label="Cost comparison" aria-live="polite">
        <h2>Comparative costs</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Energy cost</th>
              <th scope="col">Petrol</th>
              <th scope="col">Electric</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Per 100 km</th>
              <td>{money(costs.petrolPer100km)}</td>
              <td>{money(costs.electricPer100km)}</td>
            </tr>
            <tr>
              <th scope="row">Per year</th>
              <td>{money(costs.petrolAnnual)}</td>
              <td>{money(costs.electricAnnual)}</td>
            </tr>
          </tbody>
        </table>
        {slider("annualKm", "Annual distance", "km", 100)}
        <p>
          <strong>
            {Math.abs(costs.annualSaving) < 0.005
              ? "Annual energy costs are equal."
              : `${costs.annualSaving > 0 ? "Electric" : "Petrol"} saves ${money(Math.abs(costs.annualSaving))} per year.`}
          </strong>
        </p>
        <p>Electric breaks even with petrol at {costs.breakEvenPence.toFixed(1)}p/kWh.</p>
      </section>
      <p class="muted">
        Energy only: excludes purchase, tax, insurance, servicing, standing charges and
        subscriptions. Electric consumption should include charging losses; no extra loss allowance
        is added.
      </p>
      <p class="muted">
        The 6–90p/kWh slider spans low overnight home charging to rapid public charging. See{" "}
        <a href="https://www.moneysavingexpert.com/utilities/ev-energy-tariffs/">
          MoneySavingExpert’s EV tariffs
        </a>{" "}
        and{" "}
        <a href="https://www.zapmap.com/ev-stats/charging-price-index">
          Zapmap’s charging price index
        </a>
        . These are illustrative endpoints, not live quotes; rates and eligibility vary.
      </p>
      <p class="muted">Inputs are saved in the URL. Copy the address to share this comparison.</p>
    </div>
  );
}

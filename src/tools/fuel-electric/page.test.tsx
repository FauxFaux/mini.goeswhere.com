// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { useMiniLocation, useMiniSearch } from "../../boot/hash-location.ts";
import { FuelElectric } from "./page.tsx";
import { fuelElectricCodec } from "./state.ts";

afterEach(cleanup);

it("applies each example to its slider and URL while preserving selected units", async () => {
  window.history.replaceState(null, "", "/#/fuel-electric?c=6&p=150&m=30&e=20&u=litres&t=kwh");
  render(
    <Router hook={useMiniLocation} searchHook={useMiniSearch}>
      <FuelElectric />
    </Router>,
  );
  const user = userEvent.setup();
  const examples = [
    ["7p/kWh", "Charging price", 7, "c"],
    ["26p/kWh", "Charging price", 26, "c"],
    ["50p/kWh", "Charging price", 50, "c"],
    ["80p/kWh", "Charging price", 80, "c"],
    ["175p/l", "Petrol price", 175, "p"],
    ["4.4 mi/kWh", "Electric consumption", 14.12, "e"],
    ["45 UK mpg", "Petrol efficiency", 6.277, "m"],
  ] as const;
  for (const [name, slider, value, parameter] of examples) {
    await user.click(screen.getByRole("button", { name }));
    fireEvent.pointerUp(document);
    expect(
      Number((screen.getByRole("slider", { name: slider }) as HTMLInputElement).value),
    ).toBeCloseTo(value, 2);
    const params = new URLSearchParams(window.location.hash.split("?")[1]);
    expect(Number(params.get(parameter))).toBeCloseTo(parameter === "m" ? 45 : value, 2);
    expect(params.get("u")).toBe("litres");
    expect(params.get("t")).toBe("kwh");
  }
});

it("preserves consumption when switching units, persists edits and restores incoming history", async () => {
  window.history.replaceState(null, "", "/#/fuel-electric?note=keep");
  render(
    <Router hook={useMiniLocation} searchHook={useMiniSearch}>
      <FuelElectric />
    </Router>,
  );
  const results = screen.getByRole("region", { name: "Cost comparison" });
  // URL rounding may change annual totals by pennies; unit changes preserve
  // the displayed consumption and cost per 100 km.
  const initial = screen.getAllByRole("row")[1]!.textContent;
  const electricSlider = screen.getByRole("slider", {
    name: "Electric consumption",
  }) as HTMLInputElement;
  expect(Number(electricSlider.value)).toBeCloseTo(4.4);
  await userEvent
    .setup()
    .selectOptions(screen.getByRole("combobox", { name: "Electric consumption unit" }), "kwh");
  expect(screen.getAllByRole("row")[1]!.textContent).toBe(initial);
  expect(Number(electricSlider.value)).toBeCloseTo(14.121);
  await userEvent
    .setup()
    .selectOptions(screen.getByRole("combobox", { name: "Electric consumption unit" }), "miles");
  fireEvent.input(electricSlider, { target: { value: "4" } });
  await userEvent
    .setup()
    .selectOptions(screen.getByRole("combobox", { name: "Efficiency unit" }), "litres");
  expect(Number(electricSlider.value)).toBeCloseTo(4);
  fireEvent.input(screen.getByRole("slider", { name: "Charging price" }), {
    target: { value: "80" },
  });
  expect(results.textContent).toContain("Petrol saves");
  fireEvent.pointerUp(document);
  const params = new URLSearchParams(window.location.hash.split("?")[1]);
  expect(params.get("note")).toBe("keep");
  expect(params.has("s")).toBe(false);
  expect(params.get("c")).toBe("80");
  expect(fuelElectricCodec.query!.decode(params)).toMatchObject({
    chargingPence: 80,
    petrolUnit: "litres",
    mpg: 45,
    electricUnit: "miles",
  });
  expect(fuelElectricCodec.query!.decode(params).kwhPer100km).toBeCloseTo(15.53428);

  const restored = { ...fuelElectricCodec.defaultState, annualKm: 0 };
  const restoredParams = new URLSearchParams();
  fuelElectricCodec.query!.write(restoredParams, restored);
  window.history.replaceState(null, "", `/#/fuel-electric?${restoredParams}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
  await waitFor(() => expect(results.textContent).toContain("Annual energy costs are equal."));
  expect((screen.getByRole("slider", { name: "Annual distance" }) as HTMLInputElement).value).toBe(
    "0",
  );
  expect(
    (screen.getByRole("combobox", { name: "Efficiency unit" }) as HTMLSelectElement).value,
  ).toBe("mpg");
  await waitFor(() => expect(Number(electricSlider.value)).toBeCloseTo(4.4));
});

import { useMemo } from "preact/hooks";
import type { State } from "../../boot/url-state.ts";
import { MAX_UNIT_FILTER_LENGTH, type CalculatorState } from "./state.ts";
import { calculatorUnits, filterUnits, groupUnits } from "./units.ts";

export function CalculatorUnitList({ uss: [us, setUs] }: { uss: State<CalculatorState> }) {
  const filter = us.unitFilter ?? "";
  const units = useMemo(() => filterUnits(calculatorUnits, filter), [filter]);
  const groups = useMemo(() => groupUnits(units), [units]);
  return (
    <section class="calculator-units" aria-labelledby="calculator-units-heading">
      <h2 id="calculator-units-heading">Units</h2>
      <p class="muted">
        Use these names in expressions, for example <code>10 ft to m</code>. Prefix matches come
        first, then substring matches; each checks title, names, category, then base unit. Search
        ignores case; unit names in expressions may be case-sensitive.
      </p>
      <label for="calculator-unit-filter">Filter units</label>
      <input
        id="calculator-unit-filter"
        type="search"
        value={filter}
        maxLength={MAX_UNIT_FILTER_LENGTH}
        placeholder="e.g. meter, ft, temperature"
        spellcheck={false}
        autocomplete="off"
        aria-describedby="calculator-unit-count"
        onInput={(event) => {
          const unitFilter = event.currentTarget.value;
          setUs((previous) => {
            const { unitFilter: _oldFilter, ...inputs } = previous;
            return unitFilter ? { ...inputs, unitFilter } : inputs;
          });
        }}
      />
      <p id="calculator-unit-count" class="muted">
        {units.length} of {calculatorUnits.length} units
      </p>
      <div class="calculator-unit-table-scroll">
        <table class="calculator-unit-table">
          <caption>Bundled libqalculate unit definitions</caption>
          <thead>
            <tr>
              <th scope="col">Unit</th>
              <th scope="col">Names</th>
              <th scope="col">Base unit</th>
              <th scope="col">Definition</th>
            </tr>
          </thead>
          {groups.map((group, index) => (
            <tbody key={`${group.category}-${index}`}>
              <tr class="calculator-unit-category">
                <th scope="rowgroup" colSpan={4}>
                  {group.category}
                </th>
              </tr>
              {group.units.map((unit) => (
                <tr key={unit.id}>
                  <th scope="row">
                    {unit.title}
                    {unit.description && <p class="muted">{unit.description}</p>}
                  </th>
                  <td>
                    {unit.names.map((name, index) => (
                      <span key={name}>
                        {index > 0 && ", "}
                        <code>{name}</code>
                      </span>
                    ))}
                  </td>
                  <td>{unit.baseUnit || "—"}</td>
                  <td>
                    <code>{unit.definition}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
          {units.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={4}>No units match this filter.</td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </section>
  );
}

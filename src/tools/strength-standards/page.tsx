import { UrlHandler } from "../../boot/url-handler.tsx";
import type { State } from "../../boot/url-state.ts";
import { strengthStandardsCodec, type StrengthStandardsState } from "./state.ts";
import {
  bodyweightBounds,
  clampBodyweight,
  formatWeight,
  interpolateStandards,
  POUNDS_TO_KG,
  standards,
} from "./standards.ts";
import "./strength-standards.css";

export function StrengthStandards() {
  return (
    <UrlHandler codec={strengthStandardsCodec}>{(uss) => <StandardsTables uss={uss} />}</UrlHandler>
  );
}

function StandardsTables({ uss: [state, setState] }: { uss: State<StrengthStandardsState> }) {
  const population = state.sex === "men" ? "Adult men" : "Adult women";
  const minimum = standards[0][state.sex][0][0];
  const belowMinimum = state.weight !== undefined && state.weight < minimum;
  const bounds = bodyweightBounds(state.sex, state.unit);
  const factor = state.unit === "kg" ? POUNDS_TO_KG : 1;
  const displayedWeight =
    state.weight === undefined ? undefined : Number((state.weight * factor).toFixed(6));
  const setWeight = (input: number) =>
    setState((previous) => {
      const pounds = input / (previous.unit === "kg" ? POUNDS_TO_KG : 1);
      return { ...previous, weight: Number.isFinite(pounds) ? pounds : undefined };
    });
  return (
    <div class="strength-standards">
      <h1>Starting Strength standards</h1>
      <p>One-repetition maximum performance standards, not population norms.</p>
      <div class="strength-standards-controls">
        <fieldset>
          <legend>Sex</legend>
          {(["men", "women"] as const).map((sex) => (
            <label key={sex}>
              <input
                type="radio"
                name="sex"
                checked={state.sex === sex}
                onChange={() =>
                  setState((previous) => ({
                    ...previous,
                    sex,
                    ...(previous.weight === undefined
                      ? {}
                      : { weight: clampBodyweight(previous.weight, sex, previous.unit) }),
                  }))
                }
              />
              {sex === "men" ? "Men" : "Women"}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Units</legend>
          {(["kg", "lb"] as const).map((unit) => (
            <label key={unit}>
              <input
                type="radio"
                name="unit"
                checked={state.unit === unit}
                onChange={() =>
                  setState((previous) => {
                    if (previous.unit === unit) return previous;
                    const factor = unit === "kg" ? POUNDS_TO_KG : 1;
                    return {
                      ...previous,
                      unit,
                      ...(previous.weight === undefined
                        ? {}
                        : {
                            weight: clampBodyweight(
                              Math.round(previous.weight * factor) / factor,
                              previous.sex,
                              unit,
                            ),
                          }),
                    };
                  })
                }
              />
              {unit === "kg" ? "Kilograms (kg)" : "Pounds (lb)"}
            </label>
          ))}
        </fieldset>
      </div>
      <p class="strength-standards-weight">
        <label for="strength-standards-weight">Bodyweight ({state.unit})</label>
        <input
          class="strength-standards-slider"
          type="range"
          min={bounds.min}
          max={bounds.max}
          step="1"
          value={Math.round(
            Math.min(
              bounds.max,
              Math.max(bounds.min, displayedWeight ?? (bounds.min + bounds.max) / 2),
            ),
          )}
          aria-label={`Bodyweight slider (${state.unit})`}
          aria-describedby="strength-standards-weight-help"
          onInput={(event) => setWeight(event.currentTarget.valueAsNumber)}
        />
        <input
          id="strength-standards-weight"
          type="number"
          step="any"
          min={bounds.min}
          max={bounds.max}
          value={displayedWeight ?? ""}
          aria-describedby="strength-standards-weight-help"
          onInput={(event) => setWeight(event.currentTarget.valueAsNumber)}
          onBlur={() =>
            setState((previous) =>
              previous.weight === undefined
                ? previous
                : {
                    ...previous,
                    weight: clampBodyweight(previous.weight, previous.sex, previous.unit),
                  },
            )
          }
        />
      </p>
      <p id="strength-standards-weight-help" class="muted">
        Move the slider or enter a bodyweight ({bounds.min}–{bounds.max} {state.unit}). Entered
        weights are kept within these bounds when you leave the box. Clear the box to show all rows.
        Values between rows are linearly interpolated estimates, rounded to one decimal place. At or
        above the final bodyweight, its “+” row applies.
      </p>
      {belowMinimum && (
        <p role="status">
          No standards are listed below {formatWeight(minimum, state.unit)} {state.unit} for{" "}
          {population.toLowerCase()}.
        </p>
      )}
      <p class="muted">
        All bodyweights and lifts are in {state.unit}. Kilograms are converted from the original
        pounds and rounded to one decimal place. A “+” marks an open-ended bodyweight row. Your
        choices are saved in the URL.
      </p>
      {standards.map((activity) => {
        const rows = activity[state.sex];
        const selected =
          state.weight === undefined ? undefined : interpolateStandards(rows, state.weight);
        if (selected === null) return null;
        const displayedRows = selected ? [selected] : rows;
        return (
          <section key={activity.id}>
            <h2>{activity.title}</h2>
            <div
              class="strength-standards-scroll"
              role="region"
              aria-label={`${activity.title} table`}
              tabIndex={0}
            >
              <table>
                <caption>
                  {activity.title} — {population} ({state.unit})
                </caption>
                <thead>
                  <tr>
                    {state.weight === undefined && <th scope="col">Bodyweight</th>}
                    {["I", "II", "III", "IV", "V"].map((category) => (
                      <th scope="col" key={category}>
                        Cat. {category}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map(([bodyweight, ...lifts], index) => (
                    <tr key={bodyweight}>
                      {state.weight === undefined && (
                        <th scope="row">
                          {formatWeight(bodyweight, state.unit)}
                          {index === rows.length - 1 ? "+" : ""}
                        </th>
                      )}
                      {lifts.map((lift, category) => (
                        <td key={category}>{formatWeight(lift, state.unit)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p class="muted">{activity.technique}</p>
          </section>
        );
      })}
      <p class="muted">
        Tables: <a href="https://startingstrength.com/">Starting Strength</a> and{" "}
        <a href="https://aasgaardco.com/">The Aasgaard Company</a>, © 2012.{" "}
        <a href="https://startingstrength.com/files/standards.pdf">Original standards (PDF)</a>.
        Exercises use the technique in <cite>Starting Strength: Basic Barbell Training</cite>, 3rd
        edition.
      </p>
    </div>
  );
}

import { UrlHandler } from "../../boot/url-handler.tsx";
import type { State } from "../../boot/url-state.ts";
import { strengthStandardsCodec, type StrengthStandardsState } from "./state.ts";
import { formatWeight, standards } from "./standards.ts";
import "./strength-standards.css";

export function StrengthStandards() {
  return (
    <UrlHandler codec={strengthStandardsCodec}>{(uss) => <StandardsTables uss={uss} />}</UrlHandler>
  );
}

function StandardsTables({ uss: [state, setState] }: { uss: State<StrengthStandardsState> }) {
  const population = state.sex === "men" ? "Adult men" : "Adult women";
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
                onChange={() => setState((previous) => ({ ...previous, sex }))}
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
                onChange={() => setState((previous) => ({ ...previous, unit }))}
              />
              {unit === "kg" ? "Kilograms (kg)" : "Pounds (lb)"}
            </label>
          ))}
        </fieldset>
      </div>
      <p class="muted">
        All bodyweights and lifts are in {state.unit}. Kilograms are converted from the original
        pounds and rounded to one decimal place. A “+” marks an open-ended bodyweight row. Your
        choices are saved in the URL.
      </p>
      {standards.map((activity) => {
        const rows = activity[state.sex];
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
                    <th scope="col">Bodyweight</th>
                    {["I", "II", "III", "IV", "V"].map((category) => (
                      <th scope="col" key={category}>
                        Cat. {category}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([bodyweight, ...lifts], index) => (
                    <tr key={bodyweight}>
                      <th scope="row">
                        {formatWeight(bodyweight, state.unit)}
                        {index === rows.length - 1 ? "+" : ""}
                      </th>
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

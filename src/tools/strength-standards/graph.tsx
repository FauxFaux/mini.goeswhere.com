import type { StrengthStandardsState } from "./state.ts";
import { formatWeight, interpolateStandards, POUNDS_TO_KG, standards } from "./standards.ts";

// From factorio-ballet/src/compute/colours.ts (CARBON_LIGHT_SHORT).
const colours = ["#b28600", "#a56eff", "#1192e8", "#009d9a", "#ee538b"];
const categories = ["I", "II", "III", "IV", "V"];
const left = 64;
const right = 616;
const top = 36;
const bottom = 264;

export function StandardsGraph({ state }: { state: StrengthStandardsState }) {
  const weight = state.weight;
  if (weight === undefined) return null;
  const factor = state.unit === "kg" ? POUNDS_TO_KG : 1;
  const series = standards.flatMap((activity, index) => {
    const row = interpolateStandards(activity[state.sex], weight);
    return row ? [{ activity, colour: colours[index], lifts: row.slice(1) }] : [];
  });
  if (series.length === 0) return null;
  const maximum = Math.max(...series.flatMap((line) => line.lifts.map((lift) => lift * factor)));
  const ceiling = maximum * 1.05;
  const ticks = Array.from({ length: 5 }, (_, index) => (index / 4) * ceiling);
  const x = (category: number) => left + (category / 4) * (right - left);
  const y = (lift: number) => bottom - ((lift * factor) / ceiling) * (bottom - top);

  return (
    <figure class="strength-standards-graph">
      <figcaption>
        Lift standards at {formatWeight(weight, state.unit)} {state.unit} bodyweight
      </figcaption>
      <svg
        viewBox="0 0 640 320"
        role="img"
        aria-labelledby="strength-standards-graph-title"
        aria-describedby="strength-standards-graph-description"
      >
        <title id="strength-standards-graph-title">Strength standards graph</title>
        <desc id="strength-standards-graph-description">
          Five lifts for adult {state.sex}, with categories I to V on the horizontal axis and
          one-repetition maximum weight in {state.unit} on the vertical axis. Straight lines connect
          category values. Exact values are listed in the tables below.
        </desc>
        <text x={left} y="18" class="strength-standards-axis-label">
          Lift weight ({state.unit})
        </text>
        {ticks.map((tick, index) => {
          const position = y(tick / factor);
          return (
            <g key={index}>
              <line
                x1={left}
                x2={right}
                y1={position}
                y2={position}
                class="strength-standards-grid"
              />
              <text x={left - 10} y={position + 4} text-anchor="end">
                {Number(tick.toFixed(1))}
              </text>
            </g>
          );
        })}
        <line x1={left} x2={left} y1={top} y2={bottom} class="strength-standards-grid" />
        {categories.map((category, index) => (
          <text key={category} x={x(index)} y={bottom + 24} text-anchor="middle">
            {category}
          </text>
        ))}
        <text
          x={(left + right) / 2}
          y="312"
          text-anchor="middle"
          class="strength-standards-axis-label"
        >
          Category
        </text>
        {series.map(({ activity, colour, lifts }) => (
          <g key={activity.id}>
            <polyline
              points={lifts.map((lift, index) => `${x(index)},${y(lift)}`).join(" ")}
              fill="none"
              stroke={colour}
              stroke-width="2"
            />
            {lifts.map((lift, index) => (
              <circle key={index} cx={x(index)} cy={y(lift)} r="3.5" fill={colour}>
                <title>
                  {activity.title}, Cat. {categories[index]}: {formatWeight(lift, state.unit)}{" "}
                  {state.unit}
                </title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <ul class="strength-standards-legend" aria-label="Graph legend">
        {series.map(({ activity, colour }) => (
          <li key={activity.id}>
            <span
              class="strength-standards-swatch"
              style={{ backgroundColor: colour }}
              aria-hidden="true"
            />
            {activity.title}
          </li>
        ))}
      </ul>
    </figure>
  );
}

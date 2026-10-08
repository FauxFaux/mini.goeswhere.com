import { useState } from "preact/hooks";
import type { State } from "../../boot/url-state.ts";
import type { StrengthStandardsState } from "./state.ts";
import { formatWeight, interpolateStandards, POUNDS_TO_KG, standards } from "./standards.ts";

// From factorio-ballet/src/compute/colours.ts (CARBON_LIGHT_SHORT).
const colours = ["#b28600", "#a56eff", "#1192e8", "#009d9a", "#ee538b"];
const categories = ["0", "I", "II", "III", "IV", "V"];
const left = 64;
const right = 616;
const top = 36;
const bottom = 264;

export function StandardsGraph({ uss: [state, setState] }: { uss: State<StrengthStandardsState> }) {
  const [hoverPosition, setHoverPosition] = useState<number>();
  const pickedPosition =
    state.graphCategory === undefined
      ? undefined
      : state.graphCategory <= 1
        ? state.graphCategory * 2
        : state.graphCategory + 1;
  const setPickedPosition = (position: number | undefined) => {
    setState((previous) => {
      const { graphCategory: _oldCategory, ...rest } = previous;
      return position === undefined
        ? rest
        : { ...rest, graphCategory: position <= 2 ? position / 2 : position - 1 };
    });
  };
  const weight = state.weight;
  if (weight === undefined) return null;
  const factor = state.unit === "kg" ? POUNDS_TO_KG : 1;
  const series = standards.flatMap((activity, index) => {
    const row = interpolateStandards(activity[state.sex], weight);
    return row ? [{ activity, colour: colours[index], lifts: [0, ...row.slice(1)] }] : [];
  });
  if (series.length === 0) return null;
  const maximum = Math.max(...series.flatMap((line) => line.lifts.map((lift) => lift * factor)));
  const ceiling = maximum * 1.05;
  const ticks = Array.from({ length: 5 }, (_, index) => (index / 4) * ceiling);
  // Leave an extra unlabelled slot between zero and category I.
  const x = (category: number) => left + ((category === 0 ? 0 : category + 1) / 6) * (right - left);
  const y = (lift: number) => bottom - ((lift * factor) / ceiling) * (bottom - top);
  const position = hoverPosition ?? pickedPosition;
  const category = position === undefined ? undefined : position <= 2 ? position / 2 : position - 1;
  const readLift = (lifts: number[]) => {
    const lower = Math.min(Math.floor(category!), lifts.length - 2);
    return lifts[lower]! + (lifts[lower + 1]! - lifts[lower]!) * (category! - lower);
  };
  const pointerPosition = (event: { currentTarget: SVGSVGElement; clientX: number }) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0) return undefined;
    const svgX = ((event.clientX - bounds.left) / bounds.width) * 640;
    return Math.max(0, Math.min(6, ((svgX - left) / (right - left)) * 6));
  };

  return (
    <figure class="strength-standards-graph">
      <svg
        viewBox="0 0 640 320"
        role="img"
        aria-labelledby="strength-standards-graph-title"
        aria-describedby="strength-standards-graph-description"
        tabIndex={0}
        onPointerMove={(event) => setHoverPosition(pointerPosition(event))}
        onPointerLeave={() => setHoverPosition(undefined)}
        onClick={(event) => setPickedPosition(pointerPosition(event))}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setHoverPosition(undefined);
            setPickedPosition(undefined);
          } else if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            setHoverPosition(undefined);
            setPickedPosition(
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? 6
                  : Math.max(
                      0,
                      Math.min(6, (position ?? 0) + (event.key === "ArrowRight" ? 0.1 : -0.1)),
                    ),
            );
          }
        }}
      >
        <title id="strength-standards-graph-title">Strength standards graph</title>
        <desc id="strength-standards-graph-description">
          Five lifts for adult {state.sex}, with categories 0 to V on the horizontal axis and
          one-repetition maximum weight in {state.unit} on the vertical axis. All lifts start at
          zero in category 0, with an unlabelled space before category I. Straight lines connect
          category values. Exact standards are listed in the tables below. Move the pointer to read
          values; click to keep a position. Use arrow keys, Home, or End to select a position with
          the keyboard, and Escape to clear it.
        </desc>
        <text
          transform={`translate(14 ${(top + bottom) / 2}) rotate(-90)`}
          text-anchor="middle"
          class="strength-standards-axis-label"
        >
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
              <text x={left - 6} y={position + 4} text-anchor="end">
                {Number(tick.toFixed(1))}
              </text>
            </g>
          );
        })}
        <line x1={left} x2={left} y1={top} y2={bottom} class="strength-standards-grid" />
        {categories.map((category, index) => (
          <text key={category} x={x(index)} y={bottom + 24} text-anchor="middle">
            {index === 0 ? category : `Cat ${category}`}
          </text>
        ))}
        {series.map(({ activity, colour, lifts }) => (
          <g key={activity.id}>
            <line
              x1={x(0)}
              y1={y(lifts[0]!)}
              x2={x(1)}
              y2={y(lifts[1]!)}
              stroke={colour}
              stroke-width="2"
              stroke-dasharray="4 4"
            />
            <polyline
              points={lifts
                .slice(1)
                .map((lift, index) => `${x(index + 1)},${y(lift)}`)
                .join(" ")}
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
        {position !== undefined && (
          <g class="strength-standards-cursor" aria-hidden="true">
            <line
              x1={left + (position / 6) * (right - left)}
              x2={left + (position / 6) * (right - left)}
              y1={top}
              y2={bottom}
              stroke="currentColor"
              stroke-dasharray="4 4"
            />
            {series.map(({ activity, colour, lifts }) => (
              <circle
                key={activity.id}
                cx={left + (position / 6) * (right - left)}
                cy={y(readLift(lifts))}
                r="4"
                fill={colour}
              />
            ))}
          </g>
        )}
      </svg>
      <ul class="strength-standards-legend" aria-label="Graph legend">
        <li class="strength-standards-readout">
          <span>Category</span>
          <span class="strength-standards-category-value">
            {category === undefined ? "—" : Number(category.toFixed(2))}
          </span>
        </li>
        {series.map(({ activity, colour, lifts }) => (
          <li key={activity.id}>
            <span class="strength-standards-legend-label">
              <span
                class="strength-standards-swatch"
                style={{ backgroundColor: colour }}
                aria-hidden="true"
              />
              <span>{activity.title}</span>
            </span>
            <span
              class="strength-standards-legend-value"
              style={{ visibility: category === undefined ? "hidden" : "visible" }}
            >
              {category === undefined ? "—" : formatWeight(readLift(lifts), state.unit)}{" "}
              {state.unit}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

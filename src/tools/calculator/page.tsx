import { useMemo } from "preact/hooks";
import { UrlHandler } from "../../boot/url-handler.tsx";
import type { State } from "../../boot/url-state.ts";
import { evaluateExpression } from "./evaluate.ts";
import {
  calculatorCodec,
  MAX_EXPRESSION_LENGTH,
  MAX_TILES,
  type CalculatorState,
} from "./state.ts";
import "./calculator.css";

export function Calculator() {
  return <UrlHandler codec={calculatorCodec}>{(uss) => <CalculatorGrid uss={uss} />}</UrlHandler>;
}

function CalculatorGrid({ uss: [us, setUs] }: { uss: State<CalculatorState> }) {
  return (
    <>
      <h1>Calculator</h1>
      <p>Edit any expression to see its result. Your calculations are saved in this page’s URL.</p>
      <p class="muted">
        Use +, −, *, /, %, ^ and parentheses; pi, e; sqrt, sin, cos, tan, ln, log, min and max.
        Trigonometry uses radians. For example: <code>sin(pi / 2)</code>.
      </p>
      <div class="calculator-grid">
        {us.tiles.map((tile, index) => (
          <CalculatorTile
            key={tile.id}
            tile={tile}
            number={index + 1}
            onEdit={(expression) =>
              setUs((previous) => ({
                ...previous,
                tiles: previous.tiles.map((item) =>
                  item.id === tile.id ? { ...item, expression } : item,
                ),
              }))
            }
            onRemove={() =>
              setUs((previous) => ({
                ...previous,
                tiles: previous.tiles.filter((item) => item.id !== tile.id),
              }))
            }
          />
        ))}
      </div>
      {us.tiles.length === 0 && <p>No expressions yet. Add one to start calculating.</p>}
      <button
        type="button"
        disabled={us.tiles.length >= MAX_TILES}
        onClick={() =>
          setUs((previous) => ({
            ...previous,
            tiles: [...previous.tiles, { id: crypto.randomUUID(), expression: "" }],
          }))
        }
      >
        Add expression
      </button>
      {us.tiles.length >= MAX_TILES && (
        <p class="muted">Maximum of {MAX_TILES} expressions reached.</p>
      )}
    </>
  );
}

function CalculatorTile({
  tile,
  number,
  onEdit,
  onRemove,
}: {
  tile: CalculatorState["tiles"][number];
  number: number;
  onEdit: (expression: string) => void;
  onRemove: () => void;
}) {
  const result = useMemo(() => evaluateExpression(tile.expression), [tile.expression]);
  const inputId = `expression-${tile.id}`;
  const outputId = `result-${tile.id}`;
  return (
    <section class="calculator-tile" aria-label={`Calculation ${number}`}>
      <div class="calculator-tile-heading">
        <label for={inputId}>Expression {number}</label>
        <button type="button" aria-label={`Remove expression ${number}`} onClick={onRemove}>
          Remove
        </button>
      </div>
      <input
        id={inputId}
        type="text"
        value={tile.expression}
        maxLength={MAX_EXPRESSION_LENGTH}
        spellcheck={false}
        autocomplete="off"
        placeholder="e.g. 2 + 2"
        aria-describedby={outputId}
        aria-invalid={result.kind === "error"}
        onInput={(event) => onEdit(event.currentTarget.value)}
      />
      <output
        id={outputId}
        for={inputId}
        aria-live="polite"
        class={result.kind === "error" ? "error" : ""}
      >
        {result.kind === "ok"
          ? String(result.value)
          : result.kind === "error"
            ? result.message
            : "Enter an expression"}
      </output>
    </section>
  );
}

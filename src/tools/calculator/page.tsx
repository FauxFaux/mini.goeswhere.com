import { TrashIcon } from "@primer/octicons-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { UrlHandler } from "../../boot/url-handler.tsx";
import type { State } from "../../boot/url-state.ts";
import sourceUrl from "../../assets/qalculate-sources.tar.gz?url";
import licenseUrl from "../../assets/qalculate-COPYING?url";
import { CalculatorEngine } from "./engine.ts";
import { evaluateExpression, type ExpressionResult } from "./evaluate.ts";
import { CalculatorFormattedExpression } from "./formatted-expression.tsx";
import { CalculatorUnitList } from "./unit-list.tsx";
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
  const [focusId, setFocusId] = useState<string>();
  const addExpression = () => {
    if (us.tiles.length >= MAX_TILES) return;
    const id = crypto.randomUUID();
    setUs((previous) => ({
      ...previous,
      tiles: [...previous.tiles, { id, expression: "" }],
    }));
    setFocusId(id);
  };
  const engine = useMemo(() => new CalculatorEngine(), []);
  useEffect(() => () => engine.dispose(), [engine]);
  return (
    <>
      <h1>Calculator</h1>
      <p>Edit any expression to see its result. Your calculations are saved in this page’s URL.</p>
      <p class="muted">
        Use arithmetic, functions, units and symbolic expressions. Trigonometry uses radians. Try{" "}
        <code>sin(pi / 2)</code>, <code>1 m + 5 mm</code>, <code>10 kg to g</code> or{" "}
        <code>diff(x^3, x)</code>. Currency conversions use bundled exchange rates, which may be
        stale.
      </p>
      <div class="calculator-grid">
        {us.tiles.map((tile, index) => (
          <CalculatorTile
            key={tile.id}
            engine={engine}
            tile={tile}
            number={index + 1}
            focus={tile.id === focusId}
            onAdd={addExpression}
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
      <button type="button" disabled={us.tiles.length >= MAX_TILES} onClick={addExpression}>
        Add expression
      </button>
      <p class="muted">
        Powered by libqalculate 5.13.1. <a href={licenseUrl}>License</a>
        {" · "}
        <a href={sourceUrl}>Source and build recipe</a>
      </p>
      {us.tiles.length >= MAX_TILES && (
        <p class="muted">Maximum of {MAX_TILES} expressions reached.</p>
      )}
      <CalculatorUnitList uss={[us, setUs]} />
    </>
  );
}

function CalculatorTile({
  engine,
  tile,
  number,
  onEdit,
  onRemove,
  onAdd,
  focus,
}: {
  engine: CalculatorEngine;
  tile: CalculatorState["tiles"][number];
  number: number;
  onEdit: (expression: string) => void;
  onRemove: () => void;
  onAdd: () => void;
  focus: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (focus) inputRef.current?.focus();
  }, [focus]);
  const [retry, setRetry] = useState(0);
  const [completed, setCompleted] = useState<{
    expression: string;
    retry: number;
    result: ExpressionResult;
  }>();
  const result: ExpressionResult = !tile.expression.trim()
    ? { kind: "empty" }
    : completed?.expression === tile.expression && completed.retry === retry
      ? completed.result
      : { kind: "loading" };
  const pending = result.kind === "loading";
  const displayedResult =
    pending && completed && (completed.result.kind === "ok" || completed.result.kind === "error")
      ? completed.result
      : result;
  useLayoutEffect(() => {
    const controller = new AbortController();
    // Dispatch during commit; evaluation itself runs off the main thread.
    void evaluateExpression(
      tile.expression,
      (expression, signal) => engine.calculate(expression, signal),
      controller.signal,
    ).then((result) => {
      if (!controller.signal.aborted) setCompleted({ expression: tile.expression, retry, result });
    });
    return () => controller.abort();
  }, [engine, tile.expression, retry]);
  const inputId = `expression-${tile.id}`;
  const outputId = `result-${tile.id}`;
  return (
    <section class="calculator-tile" aria-label={`Calculation ${number}`}>
      <div class="calculator-input-row">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          aria-label={`Expression ${number}`}
          value={tile.expression}
          maxLength={MAX_EXPRESSION_LENGTH}
          spellcheck={false}
          autocomplete="off"
          placeholder="e.g. 2 + 2"
          aria-describedby={outputId}
          aria-invalid={result.kind === "error"}
          onInput={(event) => onEdit(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.isComposing) {
              event.preventDefault();
              onAdd();
            }
          }}
        />
        <button
          class="calculator-remove"
          type="button"
          aria-label={`Remove expression ${number}`}
          onClick={onRemove}
        >
          <TrashIcon />
        </button>
      </div>
      <div class="calculator-result" aria-busy={pending}>
        {displayedResult.kind === "ok" && (
          <div class="calculator-interpretation" aria-label="Interpreted expression">
            {displayedResult.resultIsComparison && "("}
            <CalculatorFormattedExpression html={displayedResult.input} />
            {displayedResult.resultIsComparison && ")"}
          </div>
        )}
        <output
          id={outputId}
          for={inputId}
          aria-live="polite"
          class={displayedResult.kind === "error" ? "error" : ""}
        >
          {displayedResult.kind === "ok" ? (
            <>
              <span class="calculator-equality">{displayedResult.approximate ? "≈" : "="}</span>{" "}
              {displayedResult.resultIsComparison && "("}
              <CalculatorFormattedExpression html={displayedResult.value} />
              {displayedResult.resultIsComparison && ")"}
            </>
          ) : displayedResult.kind === "error" ? (
            displayedResult.message
          ) : displayedResult.kind === "loading" ? (
            "Calculating…"
          ) : (
            "Enter an expression"
          )}
        </output>
        {displayedResult.kind === "ok" &&
          displayedResult.messages.map((message, index) => (
            <p key={index} class="muted">
              {message.text}
            </p>
          ))}
      </div>
      {result.kind === "error" && (
        <button
          type="button"
          onClick={() => {
            setRetry((value) => value + 1);
          }}
        >
          Retry
        </button>
      )}
    </section>
  );
}

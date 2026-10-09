import type { ComponentChildren } from "preact";
import { TrashIcon } from "@primer/octicons-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { UrlHandler } from "../../boot/url-handler.tsx";
import type { State } from "../../boot/url-state.ts";
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
  const lastInput = useRef<HTMLInputElement | null>(null);
  const [insertion, setInsertion] = useState<{ id: string; cursor: number }>();
  const insertUnit = (name: string) => {
    const input = lastInput.current;
    const tile = input?.isConnected
      ? us.tiles.find((tile) => `expression-${tile.id}` === input.id)
      : undefined;
    if (!tile || !input) {
      addExpression(name);
      return;
    }
    const start = Math.min(input.selectionStart ?? tile.expression.length, tile.expression.length);
    const end = Math.min(input.selectionEnd ?? start, tile.expression.length);
    const expression = tile.expression.slice(0, start) + name + tile.expression.slice(end);
    if (expression.length > MAX_EXPRESSION_LENGTH) return;
    setUs((previous) => ({
      ...previous,
      tiles: previous.tiles.map((item) => (item.id === tile.id ? { ...item, expression } : item)),
    }));
    setInsertion({ id: tile.id, cursor: start + name.length });
  };
  const addExpression = (expression = "") => {
    if (us.tiles.length >= MAX_TILES) return;
    const id = crypto.randomUUID();
    setUs((previous) => ({
      ...previous,
      tiles: [...previous.tiles, { id, expression }],
    }));
    setFocusId(id);
  };
  const engine = useMemo(() => new CalculatorEngine(), []);
  useEffect(() => () => engine.dispose(), [engine]);
  return (
    <>
      <h1>Calculator</h1>
      <p class={"muted"}>
        Return to add new. Up/down to change expression. State in URL. Trigonometry uses radians.
        Exchange rates are old.
      </p>
      <p class="muted">
        Try{" "}
        <CalculatorExample
          expression="sin((pi ∕ 2))"
          onAdd={addExpression}
          disabled={us.tiles.length >= MAX_TILES}
        >
          <span class="calculator-function">sin</span>((<span class="calculator-variable">pi</span>{" "}
          ∕ <span class="calculator-number">2</span>))
        </CalculatorExample>
        ,{" "}
        <CalculatorExample
          expression="1m+5mm"
          onAdd={addExpression}
          disabled={us.tiles.length >= MAX_TILES}
        >
          <span class="calculator-number">1</span>
          <span class="calculator-unit">m</span>+<span class="calculator-number">5</span>
          <span class="calculator-unit">mm</span>
        </CalculatorExample>
        ,{" "}
        <CalculatorExample
          expression="10 kilograms to g"
          onAdd={addExpression}
          disabled={us.tiles.length >= MAX_TILES}
        >
          <span class="calculator-number">10</span> <span class="calculator-unit">kilograms</span>{" "}
          to <span class="calculator-unit">g</span>
        </CalculatorExample>{" "}
        or{" "}
        <CalculatorExample
          expression="solve(2x + 7)"
          onAdd={addExpression}
          disabled={us.tiles.length >= MAX_TILES}
        >
          <span class="calculator-function">solve</span>(<span class="calculator-number">2</span>
          <i class="calculator-variable">x</i> + <span class="calculator-number">7</span>)
        </CalculatorExample>
        .
      </p>
      <div class="calculator-grid">
        {us.tiles.map((tile, index) => (
          <CalculatorTile
            key={tile.id}
            engine={engine}
            tile={tile}
            number={index + 1}
            focus={tile.id === focusId}
            insertion={insertion?.id === tile.id ? insertion : undefined}
            onFocus={(input) => {
              lastInput.current = input;
            }}
            onNavigate={(direction) => {
              const next = us.tiles[index + direction];
              if (!next) return false;
              const input = lastInput.current;
              const cursor = Math.min(
                input?.selectionStart ?? next.expression.length,
                next.expression.length,
              );
              setInsertion({ id: next.id, cursor });
              return true;
            }}
            onAdd={() => addExpression()}
            onEdit={(expression) =>
              setUs((previous) => ({
                ...previous,
                tiles: previous.tiles.map((item) =>
                  item.id === tile.id ? { ...item, expression } : item,
                ),
              }))
            }
            onRemove={() => {
              setUs((previous) => ({
                ...previous,
                tiles:
                  previous.tiles.length === 1
                    ? previous.tiles.map((item) => ({ ...item, expression: "" }))
                    : previous.tiles.filter((item) => item.id !== tile.id),
              }));
              if (us.tiles.length === 1) setInsertion({ id: tile.id, cursor: 0 });
            }}
          />
        ))}
      </div>
      {us.tiles.length === 0 && <p>No expressions yet. Add one to start calculating.</p>}
      <button type="button" disabled={us.tiles.length >= MAX_TILES} onClick={() => addExpression()}>
        Add expression
      </button>
      {us.tiles.length >= MAX_TILES && (
        <p class="muted">Maximum of {MAX_TILES} expressions reached.</p>
      )}
      <CalculatorUnitList uss={[us, setUs]} onInsert={insertUnit} />
      <p class="muted">Powered by libqalculate 5.13.1.</p>
    </>
  );
}

function CalculatorExample({
  expression,
  onAdd,
  disabled,
  children,
}: {
  expression: string;
  onAdd: (expression: string) => void;
  disabled: boolean;
  children: ComponentChildren;
}) {
  return (
    <button
      type="button"
      class="calculator-example"
      disabled={disabled}
      onClick={() => onAdd(expression)}
      aria-label={`Add expression ${expression}`}
    >
      <code>{children}</code>
    </button>
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
  insertion,
  onFocus,
  onNavigate,
}: {
  engine: CalculatorEngine;
  tile: CalculatorState["tiles"][number];
  number: number;
  onEdit: (expression: string) => void;
  onRemove: () => void;
  onAdd: () => void;
  focus: boolean;
  insertion: { cursor: number } | undefined;
  onFocus: (input: HTMLInputElement) => void;
  onNavigate: (direction: -1 | 1) => boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (focus) inputRef.current?.focus();
  }, [focus]);
  useLayoutEffect(() => {
    if (insertion && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(insertion.cursor, insertion.cursor);
    }
  }, [insertion]);
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
          onFocus={(event) => onFocus(event.currentTarget)}
          onInput={(event) => onEdit(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.isComposing) return;
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              if (onNavigate(event.key === "ArrowUp" ? -1 : 1)) event.preventDefault();
            }
            if (event.key === "Enter") {
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

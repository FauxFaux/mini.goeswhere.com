import type { JSX } from "preact";
import { useRef, useState } from "preact/hooks";
import { UrlHandler } from "../../boot/url-handler.tsx";
import type { State } from "../../boot/url-state.ts";
import {
  angleDelta,
  handAngle,
  handLengths,
  pickHand,
  pointOnClock,
  pointerAngle,
  turnHand,
  type Hand,
} from "./clock.ts";
import { TimeStrips } from "./time-strips.tsx";
import { localMinutes, nowSeconds, wrapSeconds } from "./year.ts";
import { analogueClockCodec, type AnalogueClockState } from "./state.ts";
import "./analogue-clock.css";

export function AnalogueClock() {
  return (
    <UrlHandler codec={analogueClockCodec} debounceMs={250}>
      {(uss) => <ClockFace uss={uss} />}
    </UrlHandler>
  );
}

interface Drag {
  pointerId: number;
  hand: Hand;
  angle: number | undefined;
  remainder: number;
}

function ClockFace({ uss: [us, setUs] }: { uss: State<AnalogueClockState> }) {
  const minutes = localMinutes(us.seconds);
  const drag = useRef<Drag | undefined>(undefined);
  const [activeHand, setActiveHand] = useState<Hand>();
  const [sideBySide, setSideBySide] = useState(false);

  function position(event: PointerEvent, face: SVGSVGElement) {
    const bounds = face.getBoundingClientRect();
    const size = Math.min(bounds.width, bounds.height);
    if (size <= 0) return undefined;
    return {
      x: ((event.clientX - bounds.left - bounds.width / 2) * 500) / size,
      y: ((event.clientY - bounds.top - bounds.height / 2) * 500) / size,
      tolerance: Math.max(20, (28 * 500) / size),
    };
  }

  const start: JSX.PointerEventHandler<SVGSVGElement> = (event) => {
    if (drag.current || event.button !== 0) return;
    const point = position(event, event.currentTarget);
    if (!point) return;
    const hand = pickHand(point, minutes, point.tolerance);
    if (!hand) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget
      .querySelector<SVGElement>(`[data-hand="${hand}"]`)
      ?.focus({ preventScroll: true });
    drag.current = { pointerId: event.pointerId, hand, angle: pointerAngle(point), remainder: 0 };
    setActiveHand(hand);
  };

  const move: JSX.PointerEventHandler<SVGSVGElement> = (event) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const point = position(event, event.currentTarget);
    if (!point) return;
    event.preventDefault();
    // Angles are unstable close to the pivot. Re-anchor after crossing this area.
    if (Math.hypot(point.x, point.y) < 24) {
      current.angle = undefined;
      return;
    }
    const angle = pointerAngle(point);
    if (current.angle !== undefined) {
      const delta = angleDelta(current.angle, angle);
      const seconds = delta * (current.hand === "hour" ? 120 : 10) + current.remainder;
      const wholeSeconds = Math.round(seconds);
      current.remainder = seconds - wholeSeconds;
      setUs((previous) => ({
        ...previous,
        seconds: wrapSeconds(previous.seconds + wholeSeconds),
      }));
    }
    current.angle = angle;
  };

  const finish: JSX.PointerEventHandler<SVGSVGElement> = (event) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = undefined;
    setActiveHand(undefined);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  function keyDown(event: JSX.TargetedKeyboardEvent<SVGGElement>, hand: Hand) {
    if (drag.current) return;
    let delta: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        delta = 1;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        delta = -1;
        break;
      case "PageUp":
        delta = 5;
        break;
      case "PageDown":
        delta = -5;
        break;
      default:
        return;
    }
    event.preventDefault();
    setUs((previous) => ({
      ...previous,
      seconds: turnHand(previous.seconds, hand, delta * (hand === "hour" ? 30 : 6)),
    }));
  }

  return (
    <section class="analogue-clock">
      <fieldset class="analogue-clock-number-options">
        <legend>Settings</legend>
        {(
          [
            ["show12HourNumbers", "12-hour numbers"],
            ["show24HourNumbers", "24-hour numbers"],
            ["showMinuteNumbers", "Minutes"],
          ] as const
        ).map(([field, label]) => (
          <label key={field}>
            <input
              type="checkbox"
              checked={us[field]}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setUs((previous) => ({ ...previous, [field]: checked }));
              }}
            />
            {label}
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={sideBySide}
            onChange={(event) => setSideBySide(event.currentTarget.checked)}
          />
          Side-by-side
        </label>
        <button
          type="button"
          onClick={() => setUs((previous) => ({ ...previous, seconds: nowSeconds() }))}
        >
          Reset to now
        </button>
      </fieldset>
      <div
        class={`analogue-clock-layout${sideBySide ? " analogue-clock-layout-side-by-side" : ""}`}
      >
        <svg
          class={`analogue-clock-face${activeHand ? " analogue-clock-dragging" : ""}${us.show24HourNumbers ? " analogue-clock-with-24h" : ""}`}
          viewBox="-250 -250 500 500"
          role="group"
          aria-label="Interactive analogue clock"
          aria-describedby="analogue-clock-help"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={(event) => {
            move(event);
            finish(event);
          }}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
          onContextMenu={(event) => event.preventDefault()}
        >
          <circle class="analogue-clock-rim" r="239" />
          <g aria-hidden="true" class="analogue-clock-ticks">
            {Array.from({ length: 60 }, (_, index) => {
              const major = index % 5 === 0;
              if (major && us.showMinuteNumbers) return null;
              const start = pointOnClock(
                index * 6,
                major ? (us.show24HourNumbers ? 215 : 207) : 220,
              );
              const end = pointOnClock(index * 6, 229);
              return (
                <line
                  key={index}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  class={major ? "analogue-clock-major-tick" : "analogue-clock-minor-tick"}
                />
              );
            })}
          </g>
          {us.show12HourNumbers && (
            <NumberRing kind="12h" radius={us.show24HourNumbers ? 193 : 177} />
          )}
          {us.show24HourNumbers && <NumberRing kind="24h" radius={160} />}
          {us.showMinuteNumbers && <NumberRing kind="minutes" radius={219} />}
          {(["hour", "minute"] as const).map((hand) => (
            <g
              key={hand}
              data-hand={hand}
              class={`analogue-clock-hand analogue-clock-${hand}${activeHand === hand ? " analogue-clock-active" : ""}`}
              transform={`rotate(${handAngle(minutes, hand)})`}
              role="slider"
              tabIndex={0}
              aria-label={hand === "hour" ? "Hour hand" : "Minute hand"}
              aria-describedby="analogue-clock-help"
              aria-valuemin={0}
              aria-valuemax={hand === "hour" ? 12 : 60}
              aria-valuenow={hand === "hour" ? (minutes % 720) / 60 : minutes % 60}
              aria-valuetext={
                hand === "hour"
                  ? `${Math.floor((minutes % 720) / 60) || 12} hours, ${Math.floor(minutes % 60)} minutes`
                  : `${Math.floor(minutes % 60)} minutes`
              }
              onKeyDown={(event) => keyDown(event, hand)}
            >
              <line
                class="analogue-clock-hand-target"
                x1="0"
                y1="-24"
                x2="0"
                y2={-handLengths[hand]}
              />
              <line
                class="analogue-clock-hand-line"
                x1="0"
                y1="12"
                x2="0"
                y2={-handLengths[hand]}
              />
              <circle
                class="analogue-clock-hand-tip"
                cx="0"
                cy={-handLengths[hand]}
                r={hand === "hour" ? 12 : 9}
              />
            </g>
          ))}
          <circle class="analogue-clock-pivot" r="13" aria-hidden="true" />
        </svg>
        <TimeStrips uss={[us, setUs]} />
      </div>
      <p id="analogue-clock-strip-help" class="muted">
        Tap or drag a strip to change the time. Use arrow keys when a clock or strip is focused.
      </p>
    </section>
  );
}

function NumberRing({ kind, radius }: { kind: "12h" | "24h" | "minutes"; radius: number }) {
  return (
    <g class={`analogue-clock-numbers analogue-clock-numbers-${kind}`} aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => {
        const point = pointOnClock(index * 30, radius);
        const hour = index || 12;
        const number = kind === "12h" ? hour : kind === "24h" ? hour + 12 : hour * 5;
        const rotation = index <= 6 ? index * 30 : index * 30 - 360;
        return (
          <text
            key={index}
            x={point.x}
            y={point.y}
            transform={kind === "minutes" ? `rotate(${rotation} ${point.x} ${point.y})` : undefined}
          >
            {number}
          </text>
        );
      })}
    </g>
  );
}

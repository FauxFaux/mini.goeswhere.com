import type { JSX } from "preact";
import { useRef, useState } from "preact/hooks";
import type { State } from "../../boot/url-state.ts";
import { dayMs } from "./astronomy.ts";
import type { EarthMoonState } from "./state.ts";

export function TimeStrips({ uss: [state, setState] }: { uss: State<EarthMoonState> }) {
  const date = new Date(state.instant);
  const dayStart = Math.floor(state.instant / dayMs) * dayMs;
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const yearSpan = Date.UTC(date.getUTCFullYear() + 1, 0, 1) - yearStart;
  return (
    <div class="earth-moon-time-strips">
      <ProgressStrip
        label="Time within this UTC day"
        valueText={date.toISOString().slice(11, 19) + " UTC"}
        instant={state.instant}
        start={dayStart}
        span={dayMs}
        step={60000}
        kind="day"
        onScrub={(instant) => setState((previous) => ({ ...previous, instant }))}
      />
      <div class="earth-moon-strip-labels" aria-hidden="true">
        {["00:00", "06:00", "12:00", "18:00", "24:00"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <ProgressStrip
        label="Time within this UTC year"
        valueText={date.toISOString().replace("T", " ").slice(0, 19) + " UTC"}
        instant={state.instant}
        start={yearStart}
        span={yearSpan}
        step={dayMs}
        kind="year"
        onScrub={(instant) => setState((previous) => ({ ...previous, instant }))}
      />
      <div class="earth-moon-strip-labels" aria-hidden="true">
        {["Jan", "Apr", "Jul", "Oct", "Jan"].map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <p id="earth-moon-strip-help" class="muted">
        Drag to scrub. Arrow keys move one minute or day; Page Up and Page Down move five. Home and
        End select the edges.
      </p>
    </div>
  );
}

function ProgressStrip({
  label,
  valueText,
  instant,
  start,
  span,
  step,
  kind,
  onScrub,
}: {
  label: string;
  valueText: string;
  instant: number;
  start: number;
  span: number;
  step: number;
  kind: "day" | "year";
  onScrub: (instant: number) => void;
}) {
  const drag = useRef<{ pointerId: number; start: number; span: number }>();
  const [dragging, setDragging] = useState(false);
  const progress = (instant - start) / span;
  const scrub = (origin: number, duration: number, fraction: number) =>
    onScrub(
      origin +
        Math.min(duration - 1000, Math.max(0, Math.round((fraction * duration) / 1000) * 1000)),
    );
  const move: JSX.PointerEventHandler<HTMLDivElement> = (event) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    event.preventDefault();
    scrub(gesture.start, gesture.span, (event.clientX - bounds.left) / bounds.width);
  };
  const finish: JSX.PointerEventHandler<HTMLDivElement> = (event) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = undefined;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyDown: JSX.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (drag.current) return;
    let target: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        target = progress + step / span;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        target = progress - step / span;
        break;
      case "PageUp":
        target = progress + (5 * step) / span;
        break;
      case "PageDown":
        target = progress - (5 * step) / span;
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    scrub(start, span, target);
  };
  return (
    <>
      <div class="earth-moon-strip-title">{label}</div>
      <div
        class={`earth-moon-progress-strip earth-moon-${kind}-strip${dragging ? " earth-moon-strip-dragging" : ""}`}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress * 100}
        aria-valuetext={valueText}
        aria-describedby="earth-moon-strip-help"
        onPointerDown={(event) => {
          if (drag.current || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, start, span };
          setDragging(true);
          move(event);
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          move(event);
          finish(event);
        }}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onKeyDown={keyDown}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span class="earth-moon-progress-marker" style={{ left: `${progress * 100}%` }} />
      </div>
    </>
  );
}

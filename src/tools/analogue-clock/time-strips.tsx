import type { JSX } from "preact";
import { MoonStrip } from "./moon-strip.tsx";
import type { State } from "../../boot/url-state.ts";
import type { AnalogueClockState } from "./state.ts";
import { scrubSeconds, scrubStep, type StripKind } from "./scrub.ts";
import { useMemo, useRef, useState } from "preact/hooks";
import { currentYear, secondsPerDay, seasonGradient, sunCycle, wallSeconds } from "./year.ts";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TimeStrips({ uss: [us, setUs] }: { uss: State<AnalogueClockState> }) {
  const seconds = us.seconds;
  const scrub = (kind: StripKind, origin: number, progress: number) => {
    setUs((previous) => ({ ...previous, seconds: scrubSeconds(kind, origin, progress) }));
  };
  const time = currentYear.at(seconds);
  const date = time.toPlainDate();
  const dateKey = date.toString();
  const sun = useMemo(() => sunCycle(date), [dateKey]);
  const seasons = useMemo(() => seasonGradient(currentYear.year), []);
  const dayProgress = wallSeconds(time) / secondsPerDay;
  const clockTime = time.toPlainTime().toString({ smallestUnit: "second" });
  const dateLabel = date.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div class="analogue-clock-time-strips">
      <ProgressStrip
        seconds={seconds}
        onScrub={scrub}
        kind="day"
        label={`Day progress: ${clockTime}. Sunrise ${sun.sunrise}, sunset ${sun.sunset}, London.`}
        progress={dayProgress}
        background={sun.gradient}
      />
      <div class="analogue-clock-strip-labels analogue-clock-day-labels" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index} class={index % 2 === 1 ? "analogue-clock-extra-hour" : undefined}>
            {String(index * 3).padStart(2, "0")}
            <span class="analogue-clock-hour-suffix">:00</span>
          </span>
        ))}
      </div>
      <MoonStrip date={new Date(time.epochMilliseconds)} />
      <ProgressStrip
        seconds={seconds}
        onScrub={scrub}
        kind="week"
        label={`Week progress: ${dateLabel}, ${clockTime}`}
        progress={(time.dayOfWeek - 1 + dayProgress) / 7}
        background="linear-gradient(to right, #253a50 0%, #253a50 71.428571%, #49395a 71.428571%, #49395a 85.714286%, #59432b 85.714286%, #59432b 100%)"
      />
      <div class="analogue-clock-week-labels" aria-hidden="true">
        {weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <ProgressStrip
        seconds={seconds}
        onScrub={scrub}
        kind="year"
        label={`Year progress: ${dateLabel}`}
        progress={seconds / currentYear.seconds}
        background={seasons}
      />
      <div class="analogue-clock-strip-labels" aria-hidden="true">
        {["Winter", "Spring", "Summer", "Autumn", "Winter"].map((season, index) => (
          <span key={index}>{season}</span>
        ))}
      </div>
    </div>
  );
}

function ProgressStrip({
  kind,
  label,
  progress,
  background,
  seconds,
  onScrub,
}: {
  kind: StripKind;
  label: string;
  progress: number;
  background: string;
  seconds: number;
  onScrub: (kind: StripKind, origin: number, progress: number) => void;
}) {
  const drag = useRef<{ pointerId: number; origin: number }>();
  const [dragging, setDragging] = useState(false);

  const move: JSX.PointerEventHandler<HTMLDivElement> = (event) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    event.preventDefault();
    onScrub(kind, gesture.origin, (event.clientX - bounds.left) / bounds.width);
  };
  const finish: JSX.PointerEventHandler<HTMLDivElement> = (event) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = undefined;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  function keyDown(event: JSX.TargetedKeyboardEvent<HTMLDivElement>) {
    if (drag.current) return;
    const step = scrubStep(kind);
    let target: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        target = progress + step;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        target = progress - step;
        break;
      case "PageUp":
        target = progress + step * 5;
        break;
      case "PageDown":
        target = progress - step * 5;
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
    onScrub(kind, seconds, target);
  }
  return (
    <div
      class={`analogue-clock-progress-strip analogue-clock-${kind}-strip${dragging ? " analogue-clock-strip-dragging" : ""}`}
      role="slider"
      tabIndex={0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress * 100}
      aria-valuetext={label}
      aria-describedby="analogue-clock-strip-help"
      aria-label={label}
      style={{ background }}
      onPointerDown={(event) => {
        if (drag.current || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, origin: seconds };
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
      <span class="analogue-clock-progress-marker" style={{ left: `${progress * 100}%` }} />
    </div>
  );
}

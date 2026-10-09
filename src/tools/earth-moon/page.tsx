import { useEffect, useMemo, useState } from "preact/hooks";
import { PauseIcon, TriangleIcon } from "@primer/octicons-react";
import { UrlHandler } from "../../boot/url-handler.tsx";
import type { State } from "../../boot/url-state.ts";
import { decodeLocation } from "../../components/location-picker/location.ts";
import { lunarCycle } from "../../components/time-strips/lunar.ts";
import {
  LocationPickerMap,
  LocationPickerMapNotes,
} from "../../components/location-picker/controls.tsx";
import { dayMs, earthMoonSnapshot, lunarOrbit } from "./astronomy.ts";
import {
  earthMoonCodec,
  minInstant,
  maxInstant,
  validInstant,
  type EarthMoonState,
} from "./state.ts";
import { EarthMoonView } from "./view.tsx";
import { TimeStrips } from "./time-strips.tsx";
import { usePlayback } from "./playback.ts";
import "./earth-moon.css";

export function EarthMoon() {
  return (
    <UrlHandler codec={earthMoonCodec} debounceMs={150}>
      {(uss) => <EarthMoonExplorer uss={uss} />}
    </UrlHandler>
  );
}

function EarthMoonExplorer({ uss: [us, persist] }: { uss: State<EarthMoonState> }) {
  const {
    mode,
    toggle,
    edit: setUs,
    frozenDays,
    observationInstant,
    scrubDay,
  } = usePlayback([us, persist]);
  const [latitude, setLatitude] = useState(String(us.location.latitude));
  const [longitude, setLongitude] = useState(String(us.location.longitude));
  const [dateInput, setDateInput] = useState(new Date(us.instant).toISOString().slice(0, 19));
  const [dateEdited, setDateEdited] = useState(false);
  const [locationError, setLocationError] = useState("");
  useEffect(() => {
    setLatitude(String(us.location.latitude));
    setLongitude(String(us.location.longitude));
  }, [us.location.latitude, us.location.longitude]);
  useEffect(() => {
    if (!dateEdited) setDateInput(new Date(us.instant).toISOString().slice(0, 19));
  }, [us.instant, dateEdited]);
  const snapshot = useMemo(
    () => earthMoonSnapshot(new Date(us.instant), us.location, frozenDays),
    [us.instant, us.location.latitude, us.location.longitude, frozenDays],
  );
  const orbit = useMemo(
    () => lunarOrbit(new Date(us.instant), frozenDays),
    [us.instant, frozenDays],
  );
  const lunarMonth = useMemo(() => lunarCycle(us.instant), [us.instant]);
  const shift = (milliseconds: number) =>
    setUs((previous) => ({
      ...previous,
      instant: Math.max(minInstant, Math.min(maxInstant, previous.instant + milliseconds)),
    }));

  return (
    <div class="earth-moon">
      <h1>Earth, Moon and your sky</h1>
      <div class="earth-moon-display">
        <div class="earth-moon-location-column">
          <section class="earth-moon-map" aria-label="Observer location">
            <h2>Observer location</h2>
            <LocationPickerMap
              uss={[
                us.location,
                (update) =>
                  setUs((previous) => ({
                    ...previous,
                    location: typeof update === "function" ? update(previous.location) : update,
                  })),
              ]}
            />
          </section>
          <section class="earth-moon-controls" aria-label="Location and time controls">
            <form
              class="earth-moon-inputs"
              onSubmit={(event) => {
                event.preventDefault();
                if (!event.currentTarget.reportValidity()) return;
                try {
                  const location = decodeLocation({
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                  });
                  const instant = dateEdited ? Date.parse(`${dateInput}Z`) : us.instant;
                  if (!validInstant(instant))
                    throw new Error("Choose a UTC date between 1900 and 2099.");
                  setLocationError("");
                  setUs((previous) => ({
                    ...previous,
                    location,
                    instant: dateEdited ? instant : previous.instant,
                  }));
                  setDateEdited(false);
                } catch (error) {
                  setLocationError(error instanceof Error ? error.message : "Invalid inputs.");
                }
              }}
            >
              <label>
                Latitude
                <input
                  type="number"
                  min={-90}
                  max={90}
                  step="any"
                  required
                  value={latitude}
                  onInput={(e) => setLatitude(e.currentTarget.value)}
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  min={-180}
                  max={180}
                  step="any"
                  required
                  value={longitude}
                  onInput={(e) => setLongitude(e.currentTarget.value)}
                />
              </label>
              <label>
                Date and time (UTC)
                <input
                  type="datetime-local"
                  min="1900-01-01T00:00:00"
                  max="2099-12-31T23:59:59"
                  step="1"
                  required
                  value={dateInput}
                  onInput={(e) => {
                    setDateInput(e.currentTarget.value);
                    setDateEdited(true);
                  }}
                />
              </label>
              <button type="submit">Update view</button>
            </form>
            {locationError && (
              <p role="alert" class="error">
                {locationError}
              </p>
            )}
            <div class="earth-moon-actions">
              <button onClick={() => shift(-dayMs)} disabled={us.instant <= minInstant}>
                −1 day
              </button>
              <button onClick={() => shift(-3600000)} disabled={us.instant <= minInstant}>
                −1 hour
              </button>
              <button
                onClick={() =>
                  setUs((previous) => ({
                    ...previous,
                    instant: Math.max(minInstant, Math.min(maxInstant, Date.now())),
                  }))
                }
              >
                Now
              </button>
              <button onClick={() => shift(3600000)} disabled={us.instant >= maxInstant}>
                +1 hour
              </button>
              <button onClick={() => shift(dayMs)} disabled={us.instant >= maxInstant}>
                +1 day
              </button>
              {(["hours", "days"] as const).map((speed) => (
                <button
                  class="earth-moon-playback"
                  aria-label={`${mode === speed ? "Pause" : "Play"} at ${speed === "hours" ? "3 hours" : "9 days"} per second${speed === "days" ? " (local time frozen)" : ""}`}
                  aria-pressed={mode === speed}
                  title={speed === "days" ? "Advance dates with local time frozen" : "Advance time"}
                  disabled={us.instant >= maxInstant && mode !== speed}
                  onClick={() => toggle(speed)}
                >
                  {mode === speed ? <PauseIcon size={16} /> : <TriangleIcon size={16} />}
                  {speed === "hours" ? "3h/s" : "9d/s"}
                </button>
              ))}
            </div>
            <TimeStrips
              uss={[us, setUs]}
              lunarMonth={lunarMonth}
              observationInstant={observationInstant}
              onDayScrub={scrubDay}
            />
            <label>
              <input
                type="checkbox"
                checked={us.trueDistance}
                onChange={(event) =>
                  setUs((previous) => ({ ...previous, trueDistance: event.currentTarget.checked }))
                }
              />{" "}
              True Earth–Moon distance scale
            </label>
          </section>
        </div>
        <div class="earth-moon-views-column">
          <EarthMoonView snapshot={snapshot} orbit={orbit} trueDistance={us.trueDistance} />
          <EarthMoonView snapshot={snapshot} orbit={orbit} trueDistance={us.trueDistance} sky />
        </div>
      </div>
      <section class="earth-moon-notes" aria-label="About these views">
        <p>See how your position on a globe becomes a horizon, and where to look for the Moon.</p>
        {frozenDays !== 0 && (
          <p class="muted">
            Local time is frozen in the 3D views; dates and orbital motion advance. Use the UTC-day
            strip to change the observation time.
          </p>
        )}
        <p class="muted">
          Lunar month: {(lunarMonth.span / dayMs).toFixed(1)} days. Brighter means more of the Moon
          is illuminated.
        </p>
        <p id="earth-moon-view-help" class="muted">
          Drag to rotate; scroll or pinch to zoom. Focus a view and use Shift + arrow keys to rotate
          it. Reset view restores its camera.
        </p>
        <p>
          <strong>
            Moon: {snapshot.moon.azimuth.toFixed(1)}° bearing from north,{" "}
            {snapshot.moon.altitude.toFixed(1)}° apparent altitude.
          </strong>{" "}
          {snapshot.moon.altitude < 0
            ? "Below your horizon."
            : "Above your horizon; look in this direction and tilt up by this angle."}{" "}
          {(snapshot.illumination.fraction * 100).toFixed(0)}% illuminated,{" "}
          {snapshot.illumination.waxing ? "waxing" : "waning"}. Distance from Earth’s centre:{" "}
          {Math.round(snapshot.moon.distance).toLocaleString("en-GB")} km.
        </p>
        <p>
          Sun: {snapshot.sun.azimuth.toFixed(1)}° bearing, {snapshot.sun.altitude.toFixed(1)}°
          apparent altitude.
        </p>
        <p class="muted">
          Red: GPS position and tangent horizon. Blue: straight up. Yellow: Moon sight line. Grey:
          28-day lunar path.
        </p>
        <p class="muted">
          In your horizon view, your position is the red point at the top of the translucent Earth.
          The red circle is your tangent horizon. Below-horizon objects remain visible through Earth
          to explain their direction. Globe and sky sizes are schematic; Sun and Moon disks are
          enlarged.
        </p>
        <p class="muted">
          {us.trueDistance
            ? "Earth and Moon radii and separation share one scale."
            : "Earth and Moon radii share one scale; separation is compressed by about 15×. The short yellow ray keeps the real sky angle; the dashed connector reaches the displaced Moon."}{" "}
          The Sun marker shows direction only. Sunlight illuminates both spheres. The lunar path
          spans ±14 days with Earth’s rotation held at the selected time.
        </p>
        <p class="muted">
          A spherical Earth and a flat local horizon are assumed. The 3D geometry omits atmospheric
          bending; the apparent altitude readouts include it. Lunar texture orientation is
          approximate; libration, terrain and eclipse shadows are omitted. Inputs are saved in the
          URL; copy the address to share this view.
        </p>
        <p class="muted">
          Positions and phases: <a href="https://github.com/mourner/suncalc">SunCalc</a>.
        </p>
        <LocationPickerMapNotes />
      </section>
    </div>
  );
}

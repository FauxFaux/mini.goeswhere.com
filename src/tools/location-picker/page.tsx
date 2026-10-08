import { useEffect, useState } from "preact/hooks";
import homolosine from "../../assets/homolosine.avif";
import { UrlHandler } from "../../boot/url-handler.tsx";
import type { State } from "../../boot/url-state.ts";
import { locationToPoint, MAP_HEIGHT, MAP_WIDTH, moveLocation, pointToLocation, roundLocation } from "./projection.ts";
import { locationPickerCodec, type LocationPickerState } from "./state.ts";
import "./location-picker.css";

export function LocationPicker() {
  return <UrlHandler codec={locationPickerCodec}>{(uss) => <Picker uss={uss} />}</UrlHandler>;
}

function Picker({ uss: [state, setState] }: { uss: State<LocationPickerState> }) {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setLatitude(state.location === null ? "" : String(state.location.latitude));
    setLongitude(state.location === null ? "" : String(state.location.longitude));
    setMessage("");
  }, [state.location?.latitude, state.location?.longitude]);
  const point = state.location === null ? null : locationToPoint(state.location);

  return (
    <>
      <h1>Location picker</h1>
      <p id="location-picker-instructions">
        Click or tap the map to pick a location. With the map focused, use arrow keys to move
        by 1°, or Shift + arrow keys for 0.1°. You can also enter coordinates below.
      </p>
      <div
        class="location-picker-map"
        role="button"
        tabIndex={0}
        aria-label="Pick a location on the world map"
        aria-describedby="location-picker-instructions"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (bounds.width === 0 || bounds.height === 0) return;
          const location = pointToLocation(
            ((event.clientX - bounds.left) / bounds.width) * MAP_WIDTH,
            ((event.clientY - bounds.top) / bounds.height) * MAP_HEIGHT,
          );
          if (location === null) {
            setMessage("That point is in a map gap. Pick inside a coloured lobe.");
            return;
          }
          setMessage("");
          setState({ v: 1, location: roundLocation(location) });
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 1;
          const deltas: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0], ArrowRight: [step, 0],
            ArrowUp: [0, step], ArrowDown: [0, -step],
            Enter: [0, 0], " ": [0, 0],
          };
          const delta = deltas[event.key];
          if (!delta) return;
          event.preventDefault();
          setMessage("");
          setState((previous) => ({
            v: 1,
            location: moveLocation(previous.location ?? { latitude: 0, longitude: 0 }, ...delta),
          }));
        }}
      >
        <img src={homolosine} width={MAP_WIDTH} height={MAP_HEIGHT} alt="" draggable={false} />
        {point !== null && (
          <span
            class="location-picker-marker"
            aria-hidden="true"
            style={{ left: `${(point[0] / MAP_WIDTH) * 100}%`, top: `${(point[1] / MAP_HEIGHT) * 100}%` }}
          />
        )}
      </div>
      <p class="location-picker-result" role="status">
        {message || (state.location === null ? "No location selected." :
          `Selected: ${Math.abs(state.location.latitude).toFixed(6)}° ${state.location.latitude < 0 ? "S" : "N"}, ${Math.abs(state.location.longitude).toFixed(6)}° ${state.location.longitude < 0 ? "W" : "E"}`)}
      </p>
      <form
        class="location-picker-coordinates"
        onSubmit={(event) => {
          event.preventDefault();
          if (!event.currentTarget.reportValidity()) return;
          setMessage("");
          setState({ v: 1, location: roundLocation({ latitude: Number(latitude), longitude: Number(longitude) }) });
        }}
      >
        <label>
          Latitude (−90 to 90)
          <input type="number" min={-90} max={90} step="any" required value={latitude}
            onInput={(event) => setLatitude(event.currentTarget.value)} />
        </label>
        <label>
          Longitude (−180 to 180)
          <input type="number" min={-180} max={180} step="any" required value={longitude}
            onInput={(event) => setLongitude(event.currentTarget.value)} />
        </label>
        <button type="submit">Set location</button>
        <button type="button" disabled={state.location === null}
          onClick={() => setState({ v: 1, location: null })}>Clear</button>
      </form>
      <p class="muted">Positive latitude is north; positive longitude is east. Your selection is saved
        in the URL; copy the address to share it.</p>
      <p class="muted">Goode’s interrupted homolosine projection preserves area. The black gaps are
        interruptions in the map, not places on Earth. Coordinates are approximate at the image’s
        resolution.</p>
    </>
  );
}

import { useEffect, useState } from "preact/hooks";
import homolosine from "../../assets/homolosine.avif";
import { UrlHandler } from "../../boot/url-handler.tsx";
import type { State } from "../../boot/url-state.ts";
import {
  locationToPoint,
  MAP_HEIGHT,
  MAP_WIDTH,
  moveLocation,
  pointToLocation,
  roundLocation,
  type Location,
} from "./projection.ts";
import { CityBrowser, useCities } from "./city-browser.tsx";
import { locationPickerCodec, type LocationPickerState } from "./state.ts";
import projectionLicense from "./projection-license.txt?url";
import "./location-picker.css";

export function LocationPicker() {
  return (
    <UrlHandler codec={locationPickerCodec} debounceMs={150}>
      {(uss) => <Picker uss={uss} />}
    </UrlHandler>
  );
}

function Picker({ uss: [state, setState] }: { uss: State<LocationPickerState> }) {
  const [latitude, setLatitude] = useState(String(state.location.latitude));
  const [longitude, setLongitude] = useState(String(state.location.longitude));
  const [catalogue, retryCities] = useCities();
  useEffect(() => {
    setLatitude(String(state.location.latitude));
    setLongitude(String(state.location.longitude));
  }, [state.location.latitude, state.location.longitude]);
  const point = locationToPoint(state.location);

  function locationAtCursor(event: {
    currentTarget: HTMLDivElement;
    clientX: number;
    clientY: number;
  }) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return null;
    return pointToLocation(
      ((event.clientX - bounds.left) / bounds.width) * MAP_WIDTH,
      ((event.clientY - bounds.top) / bounds.height) * MAP_HEIGHT,
    );
  }

  function selectLocation(location: Location | null) {
    if (location === null) return;
    setState({ v: 1, location: roundLocation(location) });
  }

  return (
    <>
      <h1>Location picker</h1>
      <div class="location-picker-top">
        <p id="location-picker-instructions">
          Click, drag, or tap the map to pick a location. With the map focused, use arrow keys to
          move by 1°, or Shift + arrow keys for 0.1°. You can also enter coordinates.
        </p>
        <form
          class="location-picker-coordinates"
          onSubmit={(event) => {
            event.preventDefault();
            if (!event.currentTarget.reportValidity()) return;
            setState({
              v: 1,
              location: roundLocation({ latitude: Number(latitude), longitude: Number(longitude) }),
            });
          }}
        >
          <label>
            Latitude (−90 to 90)
            <input
              type="number"
              min={-90}
              max={90}
              step="any"
              required
              value={latitude}
              onInput={(event) => setLatitude(event.currentTarget.value)}
            />
          </label>
          <label>
            Longitude (−180 to 180)
            <input
              type="number"
              min={-180}
              max={180}
              step="any"
              required
              value={longitude}
              onInput={(event) => setLongitude(event.currentTarget.value)}
            />
          </label>
          <button type="submit">Set location</button>
        </form>
      </div>
      <div
        class="location-picker-map"
        role="button"
        tabIndex={0}
        aria-label="Pick a location on the world map"
        aria-describedby="location-picker-instructions"
        onClick={(event) => selectLocation(locationAtCursor(event))}
        onMouseMove={(event) => {
          if (event.buttons & 1) selectLocation(locationAtCursor(event));
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 1;
          const deltas: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, step],
            ArrowDown: [0, -step],
            Enter: [0, 0],
            " ": [0, 0],
          };
          if (!Object.hasOwn(deltas, event.key)) return;
          const delta = deltas[event.key];
          if (!delta) return;
          event.preventDefault();
          setState((previous) => ({
            v: 1,
            location: moveLocation(previous.location, ...delta),
          }));
        }}
      >
        <img src={homolosine} width={MAP_WIDTH} height={MAP_HEIGHT} alt="" draggable={false} />
        <span
          class="location-picker-marker"
          aria-hidden="true"
          style={{
            left: `${(point[0] / MAP_WIDTH) * 100}%`,
            top: `${(point[1] / MAP_HEIGHT) * 100}%`,
          }}
        />
      </div>
      <CityBrowser
        catalogue={catalogue}
        retry={retryCities}
        onSelect={selectLocation}
        location={state.location}
      />
      <p class="muted">
        Positive latitude is north; positive longitude is east. Your selection is saved in the URL;
        copy the address to share it.
      </p>
      <p class="muted">
        Goode’s interrupted homolosine projection preserves area. The black gaps are interruptions
        in the map, not places on Earth. Coordinates are approximate at the image’s resolution.
      </p>
      <p class="muted">
        Map image:{" "}
        <a href="https://en.wikipedia.org/wiki/File:Goode_homolosine_projection_SW.jpg">
          Goode homolosine projection
        </a>{" "}
        by Strebe, based on NASA’s Blue Marble imagery (
        <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>). Converted to
        AVIF.
      </p>
      <p class="muted">
        World cities data from <a href="https://simplemaps.com/data/world-cities">Simplemaps</a> (
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>).
      </p>
      <p class="muted">
        Projection math adapted from{" "}
        <a href="https://github.com/d3/d3-geo-projection">d3-geo-projection</a> (
        <a href={projectionLicense}>ISC license</a>).
      </p>
    </>
  );
}

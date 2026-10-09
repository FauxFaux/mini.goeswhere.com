import { CrosshairsIcon } from "@primer/octicons-react";
import { useSearch } from "wouter";
import { useEffect, useRef, useState } from "preact/hooks";
import homolosine from "../../assets/homolosine.avif";
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
import { isInNewZealandCutout, newZealandCutoutPath } from "./new-zealand-cutout.ts";
import projectionLicense from "./projection-license.txt?url";
import { decodeLocation } from "./location.ts";
import "./location-picker.css";

export function LocationPickerControls({ uss: [location, setLocation] }: { uss: State<Location> }) {
  const excludeNewZealand = new URLSearchParams(useSearch()).get("no-nz") === "1";
  const [latitude, setLatitude] = useState(String(location.latitude));
  const [longitude, setLongitude] = useState(String(location.longitude));
  const [catalogue, retryCities] = useCities();
  useEffect(() => {
    setLatitude(String(location.latitude));
    setLongitude(String(location.longitude));
  }, [location.latitude, location.longitude]);
  function selectLocation(location: Location | null) {
    if (
      location === null ||
      (excludeNewZealand && isInNewZealandCutout(...locationToPoint(location)))
    )
      return;
    setLocation(roundLocation(location));
  }

  return (
    <>
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
            selectLocation({ latitude: Number(latitude), longitude: Number(longitude) });
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
      <LocationPickerMap uss={[location, setLocation]} describedBy="location-picker-instructions" />
      <CityBrowser
        catalogue={catalogue}
        retry={retryCities}
        onSelect={selectLocation}
        location={location}
      />
      <p class="muted">
        Positive latitude is north; positive longitude is east. Your selection is saved in the URL;
        copy the address to share it.
      </p>
      <LocationPickerMapNotes />
      <p class="muted">
        World cities data from <a href="https://simplemaps.com/data/world-cities">Simplemaps</a> (
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>).
      </p>
    </>
  );
}

/** The interactive map without coordinate controls, city data, or explanatory text. */
export function LocationPickerMap({
  uss: [location, setLocation],
  describedBy,
  requestContext,
}: {
  uss: State<Location>;
  describedBy?: string;
  /** Changes discard GPS requests made for an older view. */
  requestContext?: unknown;
}) {
  const search = useSearch();
  const excludeNewZealand = new URLSearchParams(search).get("no-nz") === "1";
  const [locationError, setLocationError] = useState("");
  const [locating, setLocating] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    requestId.current++;
    setLocating(false);
    return () => {
      requestId.current++;
    };
  }, [location.latitude, location.longitude, search, requestContext]);
  const point = locationToPoint(location);
  function locate() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is unavailable. Enter coordinates or pick a place on the map.");
      return;
    }
    const id = ++requestId.current;
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (id !== requestId.current) return;
        setLocating(false);
        try {
          const location = decodeLocation(position.coords);
          selectLocation(location);
        } catch (error) {
          setLocationError(error instanceof Error ? error.message : "Invalid GPS position.");
        }
      },
      (error) => {
        if (id !== requestId.current) return;
        setLocating(false);
        setLocationError(
          error.code === 1
            ? "Location access was declined. You can enter coordinates instead."
            : "Could not get your location. Enter coordinates or try again.",
        );
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }

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
    if (
      location === null ||
      (excludeNewZealand && isInNewZealandCutout(...locationToPoint(location)))
    )
      return;
    setLocation(roundLocation(location));
  }

  return (
    <>
      <div class="location-picker-map-container">
        <div
          class="location-picker-map"
          role="button"
          tabIndex={0}
          aria-label="Pick a location on the world map"
          aria-describedby={describedBy}
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
            setLocation((previous) => {
              const next = moveLocation(previous, ...delta);
              return excludeNewZealand && isInNewZealandCutout(...locationToPoint(next))
                ? previous
                : next;
            });
          }}
        >
          <img src={homolosine} width={MAP_WIDTH} height={MAP_HEIGHT} alt="" draggable={false} />
          {excludeNewZealand && (
            <svg
              class="location-picker-cutout"
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              aria-hidden="true"
            >
              <path d={newZealandCutoutPath} fill="#000" />
            </svg>
          )}
          <span
            hidden={excludeNewZealand && isInNewZealandCutout(...point)}
            class="location-picker-marker"
            aria-hidden="true"
            style={{
              left: `${(point[0] / MAP_WIDTH) * 100}%`,
              top: `${(point[1] / MAP_HEIGHT) * 100}%`,
            }}
          />
        </div>
        <button
          class="location-picker-locate"
          type="button"
          aria-label={locating ? "Locating…" : "Use my location"}
          title={locating ? "Locating…" : "Use my location"}
          disabled={locating}
          onClick={locate}
        >
          <CrosshairsIcon size={20} />
        </button>
      </div>
      {locationError && (
        <p role="alert" class="error">
          {locationError}
        </p>
      )}
    </>
  );
}

export function LocationPickerMapNotes() {
  return (
    <>
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
        Projection math adapted from{" "}
        <a href="https://github.com/d3/d3-geo-projection">d3-geo-projection</a> (
        <a href={projectionLicense}>ISC license</a>).
      </p>
    </>
  );
}

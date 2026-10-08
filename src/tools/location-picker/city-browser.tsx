import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { loadCities, rankCities, searchCities, type City } from "./cities.ts";
import type { Location } from "./projection.ts";

export type CityCatalogue =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; cities: City[] };

export function useCities(): [CityCatalogue, () => void] {
  const [catalogue, setCatalogue] = useState<CityCatalogue>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setCatalogue({ kind: "loading" });
    void loadCities().then(
      (cities) => {
        if (active) setCatalogue({ kind: "ready", cities });
      },
      () => {
        if (active) setCatalogue({ kind: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  return [catalogue, () => setAttempt((value) => value + 1)];
}

const pageSize = 50;

export function CityBrowser({
  catalogue,
  retry,
  onSelect,
  location,
}: {
  catalogue: CityCatalogue;
  retry: () => void;
  onSelect: (location: Location) => void;
  location: Location;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const table = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setPage(0);
    if (table.current) table.current.scrollTop = 0;
  }, [location.latitude, location.longitude, query]);
  const cities = catalogue.kind === "ready" ? catalogue.cities : null;
  const matches = useMemo(
    () => (cities === null ? [] : searchCities(cities, query)),
    [cities, query],
  );
  const ranked = useMemo(() => rankCities(matches, location), [matches, location]);
  const lastPage = Math.max(0, Math.ceil(matches.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * pageSize;
  const rows = ranked.slice(start, start + pageSize);

  return (
    <section aria-label="Cities" class="location-picker-cities">
      {catalogue.kind === "loading" ? (
        <p>Loading cities…</p>
      ) : catalogue.kind === "error" ? (
        <p role="alert">
          Could not load cities.{" "}
          <button type="button" onClick={retry}>
            Retry
          </button>
        </p>
      ) : (
        <>
          <div class="location-picker-city-toolbar">
            <label for="location-picker-city-search">Search cities, countries, or regions</label>
            <input
              id="location-picker-city-search"
              type="search"
              value={query}
              onInput={(event) => {
                setQuery(event.currentTarget.value);
                setPage(0);
              }}
            />
          </div>
          <div
            ref={table}
            class="location-picker-city-table"
            role="region"
            aria-label="City results"
            tabIndex={0}
          >
            <table aria-label="Cities">
              <thead>
                <tr>
                  <th scope="col">City</th>
                  <th scope="col" aria-sort="ascending">
                    Distance from pin
                  </th>
                  <th scope="col">Country</th>
                  <th scope="col">Region</th>
                  <th scope="col">Latitude</th>
                  <th scope="col">Longitude</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ city, distance }) => (
                  <tr key={city.id} onClick={() => onSelect(city)}>
                    <th scope="row">
                      <button
                        type="button"
                        aria-label={`Select ${city.name}, ${city.country}, ${city.region}`}
                      >
                        {city.name}
                      </button>
                    </th>
                    <td>{distance.toLocaleString("en", { maximumFractionDigits: 1 })} km</td>
                    <td>{city.country}</td>
                    <td>{city.region}</td>
                    <td>{city.latitude.toFixed(3)}°</td>
                    <td>{city.longitude.toFixed(3)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {matches.length === 0
              ? "No cities match your search."
              : `Showing ${start + 1}–${start + rows.length} of ${matches.length.toLocaleString("en")} cities. Click a city to select its location.`}
          </p>
          <div class="location-picker-city-pagination">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous cities
            </button>
            <span>
              Page {currentPage + 1} of {lastPage + 1}
            </span>
            <button
              type="button"
              disabled={currentPage === lastPage}
              onClick={() => setPage(currentPage + 1)}
            >
              Next cities
            </button>
          </div>
        </>
      )}
    </section>
  );
}

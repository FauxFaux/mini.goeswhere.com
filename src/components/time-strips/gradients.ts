import "temporal-polyfill/global";
import tzLookup from "@photostructure/tz-lookup";
import { Temporal } from "temporal-polyfill";
import { getPosition, getTimes } from "suncalc";
import { londonLocation } from "../location-picker/location.ts";
import type { Location } from "../location-picker/projection.ts";

const secondsPerDay = 86400;

export function timezoneAt(location: Location): string {
  return tzLookup(location.latitude, location.longitude);
}

export function sunCycle(
  date: Temporal.PlainDate,
  location: Location = londonLocation,
  timezone = timezoneAt(location),
) {
  const noon = date.toZonedDateTime({ timeZone: timezone, plainTime: "12:00" });
  const times = getTimes(
    new Date(noon.epochMilliseconds),
    location.latitude,
    location.longitude,
    0,
    noon.offsetNanoseconds / 60e9,
  );
  const local = (instant: Date | null) =>
    instant
      ? Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(timezone)
      : undefined;
  const sunrise = local(times.sunrise);
  const sunset = local(times.sunset);
  // Sample the displayed day so sunlight can cross midnight and polar locations
  // can have daylight, twilight, or darkness without sunrise/sunset events.
  const midnight = date.toPlainDateTime();
  const colors: readonly [number, string][] = [
    [-18, "#101a35"],
    [-6, "#202c50"],
    [-0.833, "#b27065"],
    [5, "#efd69a"],
  ];
  const stops = Array.from({ length: 97 }, (_, index) => {
    const seconds = (index * secondsPerDay) / 96;
    const time = midnight.add({ seconds }).toZonedDateTime(timezone);
    const altitude = getPosition(
      new Date(time.epochMilliseconds),
      location.latitude,
      location.longitude,
    ).altitude;
    let color = colors[0][1];
    for (let step = 1; step < colors.length; step++) {
      const [lowAltitude, lowColor] = colors[step - 1];
      const [highAltitude, highColor] = colors[step];
      if (altitude >= highAltitude) {
        color = highColor;
        continue;
      }
      const fraction = Math.max(0, (altitude - lowAltitude) / (highAltitude - lowAltitude));
      color =
        "#" +
        [1, 3, 5]
          .map((offset) => {
            const low = parseInt(lowColor.slice(offset, offset + 2), 16);
            const high = parseInt(highColor.slice(offset, offset + 2), 16);
            return Math.round(low + (high - low) * fraction)
              .toString(16)
              .padStart(2, "0");
          })
          .join("");
      break;
    }
    return { color, altitude, progress: (index / 96) * 100 };
  });
  const daylightSeconds =
    sunrise && sunset
      ? ((sunset.epochMilliseconds - sunrise.epochMilliseconds) / 1000 + secondsPerDay) %
        secondsPerDay
      : (stops.slice(0, -1).filter((stop) => stop.altitude >= -0.833).length * secondsPerDay) / 96;
  return {
    sunrise: sunrise?.toPlainTime().toString({ smallestUnit: "minute" }) ?? "unavailable",
    sunset: sunset?.toPlainTime().toString({ smallestUnit: "minute" }) ?? "unavailable",
    daylightSeconds,
    gradient: `linear-gradient(to right, ${stops.map(({ color, progress }) => `${color} ${progress}%`).join(", ")})`,
  };
}

// Meteorological seasons, blended across the year rather than precise astronomical boundaries.
export function seasonGradient(year: number, latitude: number, timezone = "Europe/London") {
  const start = Temporal.PlainDate.from({ year, month: 1, day: 1 }).toZonedDateTime(timezone);
  const end = start.add({ years: 1 });
  const span = end.epochMilliseconds - start.epochMilliseconds;
  const tropicalColor = "#b8ad85";
  // Flat colour at the equator; full seasonal variation from 24° latitude.
  const blend = Math.min(1, Math.abs(latitude) / 24);
  const winter = "#344767";
  const spring = "#54865b";
  const summer = "#dbc274";
  const autumn = "#b46d45";
  const southern = latitude < 0;
  const stops = [
    [1, southern ? summer : winter],
    [3, southern ? autumn : spring],
    [6, southern ? winter : summer],
    [9, southern ? spring : autumn],
    [12, southern ? summer : winter],
  ] as const;
  const colors = stops.map(([month, color]) => {
    const date = Temporal.PlainDate.from({ year, month, day: 1 }).toZonedDateTime(timezone);
    const blendedColor =
      "#" +
      [1, 3, 5]
        .map((offset) => {
          const base = parseInt(tropicalColor.slice(offset, offset + 2), 16);
          const seasonal = parseInt(color.slice(offset, offset + 2), 16);
          return Math.round(base + (seasonal - base) * blend)
            .toString(16)
            .padStart(2, "0");
        })
        .join("");
    return {
      color: blendedColor,
      progress: ((date.epochMilliseconds - start.epochMilliseconds) / span) * 100,
    };
  });
  return `linear-gradient(to right, ${colors.map(({ color, progress }) => `${color} ${progress}%`).join(", ")}, ${colors[0].color} 100%)`;
}

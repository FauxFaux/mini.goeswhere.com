import "temporal-polyfill/global";
import { Temporal } from "temporal-polyfill";
import { getPosition } from "suncalc";
import { londonLocation } from "../../components/location-picker/location.ts";
import type { Location } from "../../components/location-picker/projection.ts";
import { getSunTimes } from "sunrise-sunset-js/temporal";

export const londonTimezone = "Europe/London";
export const secondsPerDay = 86400;

export function yearTimeline(year: number) {
  const start = Temporal.PlainDate.from({ year, month: 1, day: 1 }).toZonedDateTime(londonTimezone);
  const end = start.add({ years: 1 });
  const seconds = (end.epochMilliseconds - start.epochMilliseconds) / 1000;
  return {
    year,
    start,
    seconds,
    at: (elapsed: number) => start.add({ seconds: elapsed }),
  };
}

const pageLoadTime = Temporal.Now.zonedDateTimeISO(londonTimezone);
export const currentYear = yearTimeline(pageLoadTime.year);
export const initialSeconds = Math.floor(
  (pageLoadTime.epochMilliseconds - currentYear.start.epochMilliseconds) / 1000,
);

export function wrapSeconds(seconds: number): number {
  const rounded = Math.round(seconds);
  return ((rounded % currentYear.seconds) + currentYear.seconds) % currentYear.seconds;
}

export function nowSeconds(): number {
  return wrapSeconds(
    Math.floor(
      (Temporal.Now.instant().epochMilliseconds - currentYear.start.epochMilliseconds) / 1000,
    ),
  );
}

export function localMinutes(seconds: number): number {
  const time = currentYear.at(seconds);
  return time.hour * 60 + time.minute + time.second / 60;
}

export function wallSeconds(time: { hour: number; minute: number; second: number }): number {
  return time.hour * 3600 + time.minute * 60 + time.second;
}

export function sunCycle(date: Temporal.PlainDate, location: Location = londonLocation) {
  const times = getSunTimes(location.latitude, location.longitude, date, {
    timezoneId: londonTimezone,
  });
  const local = (instant: { epochMilliseconds: number } | null | undefined) =>
    instant
      ? Temporal.Instant.fromEpochMilliseconds(instant.epochMilliseconds).toZonedDateTimeISO(
          londonTimezone,
        )
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
    const time = midnight.add({ seconds }).toZonedDateTime(londonTimezone);
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
export function seasonGradient(year: number, latitude: number) {
  const timeline = yearTimeline(year);
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
    const date = Temporal.PlainDate.from({ year, month, day: 1 }).toZonedDateTime(londonTimezone);
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
      progress:
        ((date.epochMilliseconds - timeline.start.epochMilliseconds) / 1000 / timeline.seconds) *
        100,
    };
  });
  return `linear-gradient(to right, ${colors.map(({ color, progress }) => `${color} ${progress}%`).join(", ")}, ${colors[0].color} 100%)`;
}

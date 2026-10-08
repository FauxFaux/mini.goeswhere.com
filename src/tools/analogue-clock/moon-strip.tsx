import { londonMoon, moonLitPath } from "./moon.ts";

export function MoonStrip({ date }: { date: Date }) {
  const moon = londonMoon(date);
  const fullness = `${Math.round(moon.fraction * 100)}% illuminated · ${moon.waxing ? "waxing" : "waning"}`;
  const description = `${moon.status}. Bearing ${moon.azimuth.toFixed(0)}°, altitude ${moon.altitude.toFixed(0)}°. ${fullness}.`;
  return (
    <>
      <div class="analogue-clock-moon-strip" role="img" aria-label={description}>
        <div class="analogue-clock-moon-horizon" />
        <MoonDisk
          fraction={moon.fraction}
          rotation={moon.rotation}
          style={{
            left: `calc(16px + (100% - 32px) * ${moon.x})`,
            top: `${16 + moon.y * 64}px`,
          }}
        />
      </div>
      <div class="analogue-clock-strip-labels" aria-hidden="true">
        <span>E</span>
        <span>SE</span>
        <span>S</span>
        <span>SW</span>
        <span>W</span>
      </div>
    </>
  );
}

function MoonDisk({
  fraction,
  rotation,
  style,
}: {
  fraction: number;
  rotation: number;
  style?: { left: string; top: string };
}) {
  return (
    <svg
      class="analogue-clock-moon-disk"
      style={style}
      viewBox="-1.1 -1.1 2.2 2.2"
      aria-hidden="true"
    >
      <circle r="1" fill="#252c38" stroke="#7d8797" stroke-width="0.06" />
      <path d={moonLitPath(fraction)} fill="#eee9d7" transform={`rotate(${rotation})`} />
    </svg>
  );
}

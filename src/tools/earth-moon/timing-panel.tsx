import { useEffect, useState } from "preact/hooks";
import type { EarthMoonTimings } from "./timings.ts";

const phases = [
  "Snapshot",
  "Lunar orbit (113 samples)",
  "Lunar cycle",
  ...["Space", "Sky"].flatMap((view) =>
    [
      "Update",
      "Dispose",
      "Build",
      "Spheres",
      "Lines",
      "Labels",
      "Resize / projection",
      "Render",
    ].map((phase) => `${view}: ${phase}`),
  ),
];

export function TimingPanel({ timings }: { timings: EarthMoonTimings }) {
  const [copyStatus, setCopyStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState(() => timings.read());
  useEffect(() => {
    if (!open) return;
    const refresh = () => setStats(timings.read());
    refresh();
    const interval = window.setInterval(refresh, 250);
    return () => window.clearInterval(interval);
  }, [open, timings]);
  const copy = async () => {
    const current = timings.read();
    setStats(current);
    const text = [
      "Earth–Moon performance timings (milliseconds per call)",
      "Mean/max and call counts cover the last 5 seconds. Live is the latest sample.",
      "Nested phases overlap. Render includes CPU/WebGL calls and shader setup, not GPU completion.",
      "Phase\tLive (ms)\t5s mean (ms)\t5s max (ms)\tCalls",
      ...phases.map((phase) => {
        const value = current.get(phase);
        return [
          phase,
          value?.live.toFixed(2) ?? "—",
          value?.mean.toFixed(2) ?? "—",
          value?.max.toFixed(2) ?? "—",
          value?.count ?? 0,
        ].join("\t");
      }),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Timings copied.");
    } catch {
      setCopyStatus("Could not copy timings. Select and copy the table instead.");
    }
  };
  return (
    <details class="earth-moon-timings" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Performance timings</summary>
      <p class="muted">
        Milliseconds per call. Live is the latest sample; mean and max cover the last 5 seconds.
        Refreshes four times per second. Build includes spheres, lines and labels; update includes
        disposal, build and rendering. Nested rows overlap. Render measures CPU work and WebGL
        calls, including shader setup, rather than GPU completion.
      </p>
      <div class="earth-moon-actions">
        <button type="button" onClick={() => void copy()}>
          Copy timings
        </button>
        <span role="status">{copyStatus}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th scope="col">Phase</th>
            <th scope="col">Live</th>
            <th scope="col">5s mean</th>
            <th scope="col">5s max</th>
            <th scope="col">Calls</th>
          </tr>
        </thead>
        <tbody>
          {phases.map((phase) => {
            const value = stats.get(phase);
            return (
              <tr key={phase}>
                <th scope="row">{phase}</th>
                <td>{value?.live.toFixed(2) ?? "—"}</td>
                <td>{value?.mean.toFixed(2) ?? "—"}</td>
                <td>{value?.max.toFixed(2) ?? "—"}</td>
                <td>{value?.count ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

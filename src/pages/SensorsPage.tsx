import { useState } from "react";
import { Download, Pause, Play } from "lucide-react";
import { useMachine } from "../contexts/MachineProvider";
import { SENSOR_CHARTS } from "../lib/sensorCharts";
import { saveBlob } from "../lib/download";
import { LiveSensorChart } from "../components/charts/LiveSensorChart";
import { SensorReadings } from "../components/sensors/SensorReadings";
import { Button } from "../components/ui/Button";
import { Segmented } from "../components/ui/Segmented";

const WINDOWS = [
  { value: "30000", label: "30 s" },
  { value: "60000", label: "1 min" },
  { value: "300000", label: "5 min" },
  { value: "900000", label: "15 min" },
];

const WINDOW_KEY = "meticulous:sensors-window";

// The last window picked, kept across tabs and visits.
const readWindow = () => {
  try {
    const stored = localStorage.getItem(WINDOW_KEY);
    if (stored && WINDOWS.some((option) => option.value === stored)) {
      return stored;
    }
  } catch {
    // Default below.
  }
  return "60000";
};

const exportCsv = (live: ReturnType<typeof useMachine>["live"]) => {
  const statusKeys = live.statusBuffer.keys();
  const sensorKeys = live.sensorBuffer.keys();
  const header = ["time", "unix_ms", ...statusKeys, ...sensorKeys];
  const blank = (count: number) => Array<string>(count).fill("");
  const rows = [
    ...live.statusBuffer
      .rows(statusKeys)
      .map(([time, ...values]) => [
        time,
        ...values,
        ...blank(sensorKeys.length),
      ]),
    ...live.sensorBuffer
      .rows(sensorKeys)
      .map(([time, ...values]) => [
        time,
        ...blank(statusKeys.length),
        ...values,
      ]),
  ].sort((a, b) => Number(a[0]) - Number(b[0]));
  const lines = [
    header.join(","),
    ...rows.map(([time, ...values]) =>
      [
        new Date(Number(time)).toISOString(),
        time,
        ...values.map((value) => value ?? ""),
      ].join(","),
    ),
  ];
  saveBlob(
    new Blob([lines.join("\n")], { type: "text/csv" }),
    `sensors-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
  );
};

const SensorsPage = () => {
  const { live, connection } = useMachine();
  const [windowMs, setWindowMs] = useState(readWindow);
  const [paused, setPaused] = useState(false);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 lg:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-ink">Live sensors</h1>
          <p className="mt-1 text-sm text-ink-2">
            Every sensor the machine streams, about 10 times a second.
            {connection !== "connected" && " Waiting for the machine…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Time window"
            value={windowMs}
            onChange={(value) => {
              setWindowMs(value);
              try {
                localStorage.setItem(WINDOW_KEY, value);
              } catch {
                // Not remembered; still applies now.
              }
            }}
            options={WINDOWS}
          />
          <Button
            variant={paused ? "primary" : "secondary"}
            onClick={() => setPaused((value) => !value)}
            aria-pressed={paused}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button
            variant="outline"
            onClick={() => exportCsv(live)}
            title="Download everything recorded since this page opened (up to ~25 minutes)"
          >
            <Download size={16} />
            CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SENSOR_CHARTS.map((def) => (
          <LiveSensorChart
            key={def.id}
            def={def}
            live={live}
            windowMs={Number(windowMs)}
            paused={paused}
          />
        ))}
      </div>

      <SensorReadings />
    </div>
  );
};

export default SensorsPage;

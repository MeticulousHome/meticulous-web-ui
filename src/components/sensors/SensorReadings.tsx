import { TriangleAlert } from "lucide-react";
import { useLiveSensors, useLiveStatus } from "../../contexts/MachineProvider";
import {
  SENSOR_LABELS,
  SENSOR_RANGES,
  SENSOR_UNITS,
} from "../../lib/sensorCharts";

interface Reading {
  key: string;
  label: string;
  value: string;
  unit?: string;
  outOfRange?: string;
}

const format = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (value === null || value === undefined) return "–";
  return String(value);
};

// Every key of the latest status and sensors messages, including ones this
// UI doesn't know yet, with readings outside their expected range flagged.
export const SensorReadings = () => {
  const sensors = useLiveSensors();
  const status = useLiveStatus();

  const statusReadings: Reading[] = status
    ? [
        { key: "state", label: "State", value: status.state },
        { key: "name", label: "Stage", value: status.name },
        {
          key: "p",
          label: "Pressure",
          value: format(status.sensors?.p),
          unit: "bar",
        },
        {
          key: "f",
          label: "Flow",
          value: format(status.sensors?.f),
          unit: "ml/s",
        },
        {
          key: "w",
          label: "Weight",
          value: format(status.sensors?.w),
          unit: "g",
        },
        {
          key: "g",
          label: "Grav. flow",
          value: format(status.sensors?.g),
          unit: "g/s",
        },
        {
          key: "t",
          label: "Temperature",
          value: format(status.sensors?.t),
          unit: "°C",
        },
        ...Object.entries(status.setpoints ?? {}).map(([key, value]) => ({
          key: `setpoint-${key}`,
          label: `Setpoint ${key}`,
          value: format(value),
        })),
      ]
    : [];

  const sensorReadings: Reading[] = Object.entries(sensors ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const range = SENSOR_RANGES[key];
      const outOfRange =
        range &&
        typeof value === "number" &&
        (value < range.min || value > range.max)
          ? `Expected ${range.min} to ${range.max}`
          : undefined;
      return {
        key,
        label: SENSOR_LABELS[key] ?? key,
        value: format(value),
        unit: SENSOR_UNITS[key],
        outOfRange,
      };
    });

  const group = (title: string, readings: Reading[]) => (
    <div>
      <h3 className="mb-2 text-sm text-ink-2">{title}</h3>
      {readings.length === 0 ? (
        <p className="text-sm text-ink-3">No data yet.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {readings.map((reading) => (
            <div
              key={reading.key}
              className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-3 py-2.5"
              title={reading.outOfRange}
            >
              <dt className="flex items-center gap-1 truncate text-xs text-ink-2">
                {reading.outOfRange && (
                  <TriangleAlert
                    size={12}
                    className="shrink-0 text-warn"
                    aria-label="Out of range"
                  />
                )}
                <span className="truncate">{reading.label}</span>
                <span className="ml-auto font-mono text-[10px] text-ink-3">
                  {reading.key}
                </span>
              </dt>
              <dd className="truncate text-base text-ink">
                {reading.value}
                {reading.unit && (
                  <span className="ml-1 text-xs text-ink-3">
                    {reading.unit}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );

  return (
    <section aria-labelledby="readings-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="readings-heading" className="text-xl text-ink">
          Raw readings
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          The latest message of each stream.{" "}
          <TriangleAlert size={12} className="inline text-warn" /> marks a
          reading outside its expected range.
        </p>
      </div>
      {group("Status", statusReadings)}
      {group("Sensors", sensorReadings)}
    </section>
  );
};

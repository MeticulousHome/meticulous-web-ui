import type { StatusData } from "@meticulous-home/espresso-api";

// Raw "sensors" socket payload: numbers, plus a few booleans (w_stat) and the
// occasional "NaN" string for a sensor that isn't fitted.
export type SensorPayload = Record<string, number | string | boolean | null>;

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
};

// Fixed-size ring buffer of timestamped samples, one column per key. Charts
// read it on their own schedule, so socket traffic never re-renders React.
export class SeriesBuffer {
  private readonly capacity: number;
  private readonly times: Float64Array;
  private readonly columns = new Map<string, Float64Array>();
  private start = 0;
  private size = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.times = new Float64Array(capacity);
  }

  push(time: number, values: Record<string, unknown>) {
    let index: number;
    if (this.size < this.capacity) {
      index = (this.start + this.size) % this.capacity;
      this.size++;
    } else {
      index = this.start;
      this.start = (this.start + 1) % this.capacity;
    }
    this.times[index] = time;
    for (const column of this.columns.values()) column[index] = NaN;
    for (const key in values) {
      let column = this.columns.get(key);
      if (!column) {
        column = new Float64Array(this.capacity).fill(NaN);
        this.columns.set(key, column);
      }
      column[index] = toNumber(values[key]);
    }
  }

  clear() {
    this.start = 0;
    this.size = 0;
    this.columns.clear();
  }

  get length() {
    return this.size;
  }

  keys() {
    return [...this.columns.keys()];
  }

  latest(key: string) {
    const column = this.columns.get(key);
    if (!column || this.size === 0) return NaN;
    return column[(this.start + this.size - 1) % this.capacity];
  }

  // [time, value] pairs newer than `since`; missing readings become null so
  // the chart draws a gap instead of a fake zero.
  series(key: string, since: number): [number, number | null][] {
    const column = this.columns.get(key);
    const points: [number, number | null][] = [];
    if (!column) return points;
    for (let i = 0; i < this.size; i++) {
      const index = (this.start + i) % this.capacity;
      const time = this.times[index];
      if (time < since) continue;
      const value = column[index];
      points.push([time, Number.isNaN(value) ? null : value]);
    }
    return points;
  }

  // Every sample as rows, for CSV export.
  rows(keys: string[]) {
    const rows: (number | null)[][] = [];
    for (let i = 0; i < this.size; i++) {
      const index = (this.start + i) % this.capacity;
      rows.push([
        this.times[index],
        ...keys.map((key) => {
          const value = this.columns.get(key)?.[index] ?? NaN;
          return Number.isNaN(value) ? null : value;
        }),
      ]);
    }
    return rows;
  }
}

export interface ShotPoint {
  time: number; // seconds into the shot
  pressure: number;
  flow: number;
  weight: number;
  gravimetric_flow: number;
}

// The status fields worth plotting, flattened to one level.
const flattenStatus = (status: StatusData): Record<string, unknown> => {
  const { sensors, setpoints } = status;
  return {
    pressure: sensors?.p,
    flow: sensors?.f,
    weight: sensors?.w,
    temperature: sensors?.t,
    gravimetric_flow: sensors?.g,
    setpoint_pressure: setpoints?.pressure,
    setpoint_flow: setpoints?.flow,
    setpoint_temperature: setpoints?.temperature,
    setpoint_power: setpoints?.power,
    setpoint_piston: setpoints?.piston,
  };
};

// About 25 minutes of the ~10 Hz status and sensor streams.
const BUFFER_CAPACITY = 15_000;

type Listener = () => void;

export class LiveStore {
  status: StatusData | null = null;
  sensors: SensorPayload | null = null;
  readonly statusBuffer = new SeriesBuffer(BUFFER_CAPACITY);
  readonly sensorBuffer = new SeriesBuffer(BUFFER_CAPACITY);
  // The shot in progress (or the one that just ended), from the status stream.
  liveShot: ShotPoint[] = [];
  liveShotVersion = 0;
  // Seconds of preheat left, from "heater_status"; 0 when not preheating.
  preheatRemaining = 0;

  private readonly statusListeners = new Set<Listener>();
  private readonly sensorListeners = new Set<Listener>();

  pushStatus(status: StatusData) {
    const previous = this.status;
    this.status = status;
    this.statusBuffer.push(Date.now(), flattenStatus(status));

    if (previous?.state === "idle" && status.state !== "idle") {
      this.liveShot = [];
      this.liveShotVersion++;
    }
    if (status.extracting && status.sensors) {
      // Mutated in place; readers watch liveShotVersion.
      this.liveShot.push({
        time: status.time / 1000,
        pressure: status.sensors.p,
        flow: status.sensors.f,
        weight: status.sensors.w,
        gravimetric_flow: status.sensors.g,
      });
      this.liveShotVersion++;
    }
    this.statusListeners.forEach((listener) => listener());
  }

  pushHeaterStatus(preheatRemaining: unknown) {
    this.preheatRemaining =
      typeof preheatRemaining === "number" && preheatRemaining > 0
        ? preheatRemaining
        : 0;
    this.statusListeners.forEach((listener) => listener());
  }

  pushSensors(sensors: SensorPayload) {
    this.sensors = sensors;
    this.sensorBuffer.push(Date.now(), sensors);
    this.sensorListeners.forEach((listener) => listener());
  }

  reset() {
    this.status = null;
    this.sensors = null;
    this.statusBuffer.clear();
    this.sensorBuffer.clear();
    this.liveShot = [];
    this.liveShotVersion++;
    this.preheatRemaining = 0;
    this.statusListeners.forEach((listener) => listener());
    this.sensorListeners.forEach((listener) => listener());
  }

  subscribeStatus = (listener: Listener) => {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  };

  subscribeSensors = (listener: Listener) => {
    this.sensorListeners.add(listener);
    return () => {
      this.sensorListeners.delete(listener);
    };
  };
}

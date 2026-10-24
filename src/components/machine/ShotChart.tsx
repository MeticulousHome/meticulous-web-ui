import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLiveShotVersion,
  useStatusField,
  useMachine,
} from "../../contexts/MachineProvider";
import { useLastShot } from "../../hooks/useMachineData";
import type { ShotPoint } from "../../lib/liveStore";
import { useResolvedTheme } from "../../theme";
import { Segmented } from "../ui/Segmented";
import {
  axisStyle,
  chartColors,
  formatValue,
  tooltipStyle,
  useEChart,
} from "../charts/echarts";

type Metric = "pressure" | "flow" | "weight" | "gravimetric_flow";

// Same slots as the Extraction chart on the Sensors tab, so each quantity
// keeps its color across the app.
const METRICS: {
  value: Metric;
  label: string;
  unit: string;
  slot: number;
  floor: number;
}[] = [
  { value: "pressure", label: "Pressure", unit: "bar", slot: 0, floor: 12 },
  { value: "flow", label: "Flow", unit: "ml/s", slot: 1, floor: 8 },
  { value: "weight", label: "Weight", unit: "g", slot: 2, floor: 40 },
  {
    value: "gravimetric_flow",
    label: "Grav. flow",
    unit: "g/s",
    slot: 3,
    floor: 4,
  },
];

const METRIC_KEY = "meticulous:shot-metric";

const readMetric = (): Metric => {
  try {
    const stored = localStorage.getItem(METRIC_KEY);
    if (METRICS.some((metric) => metric.value === stored))
      return stored as Metric;
  } catch {
    // Default below.
  }
  return "weight";
};

export const ShotChart = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chart = useEChart(containerRef);
  const theme = useResolvedTheme();
  const { live } = useMachine();
  const extracting = useStatusField((status) => !!status?.extracting);
  const loadedProfile = useStatusField((status) => status?.loaded_profile);
  const liveVersion = useLiveShotVersion();
  const lastShot = useLastShot();
  const [metric, setMetric] = useState<Metric>(readMetric);

  const historyPoints = useMemo<ShotPoint[]>(
    () =>
      (lastShot.data?.data ?? []).map((point) => ({
        time: point.time / 1000,
        pressure: point.shot.pressure,
        flow: point.shot.flow,
        weight: point.shot.weight,
        gravimetric_flow: point.shot.gravimetric_flow,
      })),
    [lastShot.data],
  );

  // While brewing, the shot builds up from the status stream; otherwise the
  // last saved shot (falling back to the stream until history catches up).
  const showLive =
    extracting || (historyPoints.length === 0 && live.liveShot.length > 0);
  const points = showLive ? live.liveShot : historyPoints;
  const meta = METRICS.find((item) => item.value === metric) ?? METRICS[2];
  const duration = points.length ? points[points.length - 1].time : 0;
  const finalWeight = points.length
    ? points[points.length - 1].weight
    : undefined;
  const profileName = showLive ? loadedProfile : lastShot.data?.profile?.name;

  useEffect(() => {
    if (!chart) return;
    const colors = chartColors();
    const color = colors.series[meta.slot];
    const axis = axisStyle(colors);
    const data = points.map((point) => [point.time, point[metric]]);
    const last = data[data.length - 1];
    const xMax = Math.max(60, Math.ceil(duration / 10) * 10);
    chart.setOption(
      {
        animation: false,
        grid: { left: 4, right: 4, top: 12, bottom: 4, containLabel: true },
        xAxis: {
          type: "value",
          min: 0,
          max: xMax,
          interval: 10,
          ...axis,
          splitLine: {
            show: true,
            lineStyle: { color: colors.grid, type: [3, 4] },
          },
          axisLabel: {
            ...axis.axisLabel,
            formatter: (value: number) =>
              value === xMax ? `${value} s` : `${value}`,
          },
        },
        yAxis: {
          type: "value",
          position: "right",
          min: (extent: { min: number }) =>
            Number.isFinite(extent.min) ? Math.min(0, extent.min) : 0,
          max: (extent: { max: number }) =>
            Number.isFinite(extent.max)
              ? Math.max(meta.floor, extent.max)
              : meta.floor,
          splitNumber: 2,
          ...axis,
          splitLine: { show: false },
          axisLabel: { ...axis.axisLabel, formatter: `{value} ${meta.unit}` },
        },
        tooltip: {
          trigger: "axis",
          ...tooltipStyle(colors),
          axisPointer: {
            type: "line",
            lineStyle: { color: colors.ink3, width: 1 },
          },
          formatter: (params: { value: [number, number] }[]) => {
            const [time, value] = params[0]?.value ?? [];
            return `<span style="color:${colors.ink3}">${formatValue(time)} s</span>&nbsp;&nbsp;<b style="font-weight:500">${formatValue(value)} ${meta.unit}</b>`;
          },
        },
        series: [
          {
            type: "line",
            data,
            showSymbol: false,
            smooth: 0.2,
            lineStyle: { width: 2, color, cap: "round", join: "round" },
            itemStyle: { color },
            areaStyle: { color, opacity: 0.1 },
            emphasis: { disabled: true },
          },
          {
            // End dot with a ring in the surface color.
            type: "line",
            data: last ? [last] : [],
            symbol: "circle",
            symbolSize: 9,
            itemStyle: { color, borderColor: colors.canvas, borderWidth: 2 },
            lineStyle: { opacity: 0 },
            tooltip: { show: false },
            silent: true,
            z: 3,
          },
        ],
      },
      { notMerge: true },
    );
    // liveVersion: the live shot array is mutated in place.
  }, [chart, points, metric, meta, duration, theme, liveVersion]);

  return (
    <section aria-label="Shot chart" className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          <span className="text-ink">
            {extracting ? "Live shot" : showLive ? "This shot" : "Last shot"}
          </span>
          {points.length > 0 && (
            <span className="text-ink-3">
              {profileName ? ` · ${profileName}` : ""} · {formatValue(duration)}{" "}
              s
              {finalWeight !== undefined
                ? ` · ${formatValue(finalWeight)} g`
                : ""}
            </span>
          )}
        </div>
        <Segmented
          label="Shot chart metric"
          size="sm"
          value={metric}
          onChange={(value) => {
            setMetric(value);
            try {
              localStorage.setItem(METRIC_KEY, value);
            } catch {
              // Not remembered.
            }
          }}
          options={METRICS.map((item) => ({
            value: item.value,
            label: item.label,
          }))}
        />
      </div>
      <div className="relative mt-2">
        <div ref={containerRef} className="h-[150px] w-full sm:h-[160px]" />
        {points.length === 0 && !lastShot.isLoading && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-3">
            No shot yet. Start one and it draws here.
          </p>
        )}
      </div>
    </section>
  );
};

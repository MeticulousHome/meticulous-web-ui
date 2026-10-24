import { useEffect, useMemo, useRef, useState } from "react";
import type { SensorChartDef, SensorSeries } from "../../lib/sensorCharts";
import type { LiveStore } from "../../lib/liveStore";
import { useResolvedTheme } from "../../theme";
import {
  axisStyle,
  chartColors,
  formatValue,
  tooltipStyle,
  useEChart,
  type ChartColors,
} from "./echarts";

interface LiveSensorChartProps {
  def: SensorChartDef;
  live: LiveStore;
  windowMs: number;
  paused: boolean;
}

const bufferFor = (live: LiveStore, series: SensorSeries) =>
  series.source === "status" ? live.statusBuffer : live.sensorBuffer;

// Colors follow each series' slot in the chart; a target shares the color of
// the series it targets and is drawn dashed.
const seriesColors = (def: SensorChartDef, colors: ChartColors) => {
  const byKey = new Map<string, string>();
  let slot = 0;
  def.series.forEach((series) => {
    if (!series.targetOf) byKey.set(series.key, colors.series[slot++ % 8]);
  });
  return def.series.map(
    (series) => byKey.get(series.targetOf ?? series.key) ?? colors.ink3,
  );
};

// Rounds outward to one significant digit: -247.3 -> -300, 13.2 -> 20.
const niceBound = (value: number, direction: "down" | "up") => {
  if (value === 0) return 0;
  const step = 10 ** Math.floor(Math.log10(Math.abs(value)));
  const round = direction === "down" ? Math.floor : Math.ceil;
  return round(value / step) * step;
};

// Y ranges from the preset are a floor; the axis grows to fit readings.
const axisBounds = (preset: { min: number; max: number }) => ({
  min: (extent: { min: number }) =>
    Number.isFinite(extent.min) && extent.min < preset.min
      ? niceBound(extent.min, "down")
      : preset.min,
  max: (extent: { max: number }) =>
    Number.isFinite(extent.max) && extent.max > preset.max
      ? niceBound(extent.max, "up")
      : preset.max,
});

const timeLabel = (value: number) =>
  new Date(value).toLocaleTimeString([], { hour12: false });

export const LiveSensorChart = ({
  def,
  live,
  windowMs,
  paused,
}: LiveSensorChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chart = useEChart(containerRef);
  const theme = useResolvedTheme();
  const [visible, setVisible] = useState(() =>
    def.series.map((series) => !series.hidden),
  );
  const [latest, setLatest] = useState<number[]>(() =>
    def.series.map(() => NaN),
  );
  // Re-read the CSS colors whenever the theme flips.
  const colors = useMemo(() => chartColors(), [theme]);
  const lineColors = useMemo(() => seriesColors(def, colors), [def, colors]);

  // Full option: on mount, theme change and legend toggles.
  useEffect(() => {
    if (!chart) return;
    const axis = axisStyle(colors);
    const yAxes = [
      {
        type: "value",
        position: "left",
        name: def.left.name,
        ...axisBounds(def.left),
        ...axis,
      },
    ];
    if (def.right) {
      yAxes.push({
        type: "value",
        position: "right",
        name: def.right.name,
        ...axisBounds(def.right),
        ...axis,
        splitLine: { show: false, lineStyle: axis.splitLine.lineStyle },
      } as (typeof yAxes)[number]);
    }
    chart.setOption(
      {
        animation: false,
        backgroundColor: "transparent",
        grid: { left: 8, right: 8, top: 28, bottom: 4, containLabel: true },
        xAxis: {
          type: "time",
          splitNumber: 5,
          ...axis,
          splitLine: { show: false },
          axisLabel: {
            ...axis.axisLabel,
            formatter: timeLabel,
            hideOverlap: true,
          },
        },
        yAxis: yAxes,
        tooltip: {
          trigger: "axis",
          ...tooltipStyle(colors),
          axisPointer: {
            type: "line",
            lineStyle: { color: colors.ink3, width: 1 },
          },
          formatter: (
            params: { seriesIndex: number; value: [number, number | null] }[],
          ) => {
            if (!params.length) return "";
            const time = new Date(params[0].value[0]).toLocaleTimeString([], {
              hour12: false,
            });
            const rows = params
              .map(({ seriesIndex, value }) => {
                const series = def.series[seriesIndex];
                return `<div style="display:flex;align-items:center;gap:8px;justify-content:space-between"><span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:2px;border-radius:2px;background:${lineColors[seriesIndex]}"></span>${series.label}</span><span>${formatValue(value[1], series.digits ?? 1)} ${series.unit}</span></div>`;
              })
              .join("");
            return `<div style="color:${colors.ink3};margin-bottom:4px">${time}</div>${rows}`;
          },
        },
        series: def.series.map((series, index) => ({
          id: series.key,
          name: series.label,
          type: "line",
          yAxisIndex: series.axis === "right" && def.right ? 1 : 0,
          showSymbol: false,
          sampling: "lttb",
          connectNulls: false,
          lineStyle: {
            width: series.targetOf ? 1.5 : 2,
            type: series.targetOf ? "dashed" : "solid",
            color: lineColors[index],
            cap: "round",
            join: "round",
          },
          itemStyle: { color: lineColors[index] },
          emphasis: { disabled: true },
          data: [],
        })),
      },
      { notMerge: true },
    );
  }, [chart, def, colors, lineColors]);

  // Data: redraw a few times a second from the buffers. Paused, the window
  // stays where it was (the buffers keep recording underneath), so toggling a
  // series or hovering still works on the frozen view.
  const pausedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!chart) return;
    if (paused) pausedAt.current ??= Date.now();
    else pausedAt.current = null;
    const draw = () => {
      const now = pausedAt.current ?? Date.now();
      const since = now - windowMs;
      chart.setOption({
        xAxis: { min: since, max: now },
        series: def.series.map((series, index) => ({
          id: series.key,
          data: visible[index]
            ? bufferFor(live, series).series(series.key, since)
            : [],
        })),
      });
      setLatest(
        def.series.map((series) => bufferFor(live, series).latest(series.key)),
      );
    };
    draw();
    if (paused) return;
    const timer = setInterval(draw, windowMs > 120_000 ? 1000 : 250);
    return () => clearInterval(timer);
  }, [chart, def, live, windowMs, paused, visible]);

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm text-ink">{def.title}</h3>
        {def.right && (
          <span className="text-[11px] text-ink-3">
            {def.left.name} left · {def.right.name} right
          </span>
        )}
      </header>
      <ul className="mt-3 flex flex-wrap gap-x-1 gap-y-1">
        {def.series.map((series, index) => (
          <li key={series.key}>
            <button
              type="button"
              aria-pressed={visible[index]}
              title={`${visible[index] ? "Hide" : "Show"} ${series.label}${series.axis === "right" && def.right ? " (right axis)" : ""}`}
              onClick={() =>
                setVisible((current) =>
                  current.map((value, i) => (i === index ? !value : value)),
                )
              }
              className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-raised ${
                visible[index]
                  ? "text-ink-2"
                  : "text-ink-3 line-through decoration-ink-3/60"
              }`}
            >
              <span
                className="h-0.5 w-3 shrink-0 rounded-full"
                style={{
                  background: series.targetOf
                    ? `repeating-linear-gradient(90deg, ${lineColors[index]} 0 3px, transparent 3px 5px)`
                    : lineColors[index],
                  opacity: visible[index] ? 1 : 0.35,
                }}
              />
              <span>{series.label}</span>
              <span className="text-ink">
                {formatValue(latest[index], series.digits ?? 1)}
              </span>
              <span className="text-ink-3">{series.unit}</span>
              {series.axis === "right" && def.right && (
                <span className="text-[10px] text-ink-3" aria-hidden="true">
                  R
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div ref={containerRef} className="mt-1 h-56 w-full" />
    </section>
  );
};

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLiveShotVersion,
  useStatusField,
  useMachine,
} from "../../contexts/MachineProvider";
import { useLastShot } from "../../hooks/useMachineData";
import type { ShotPoint } from "../../lib/liveStore";
import { useResolvedTheme } from "../../theme";
import {
  axisStyle,
  chartColors,
  formatValue,
  tooltipStyle,
  useEChart,
} from "../charts/echarts";

type Metric = "pressure" | "weight" | "gravimetric_flow";

// Same color slots as the Extraction chart on the Sensors tab, so each
// quantity keeps its color across the app. Pressure and grav. flow share the
// left axis; weight, with its larger range, has the right one.
const SERIES: {
  key: Metric;
  label: string;
  unit: string;
  slot: number;
  axis: 0 | 1;
}[] = [
  { key: "pressure", label: "Pressure", unit: "bar", slot: 0, axis: 0 },
  { key: "weight", label: "Weight", unit: "g", slot: 2, axis: 1 },
  {
    key: "gravimetric_flow",
    label: "Grav. flow",
    unit: "g/s",
    slot: 3,
    axis: 0,
  },
];

// Axis ranges are a floor; an axis grows to fit the shot, in whole steps.
const LEFT_FLOOR = 12; // bar, g/s
const LEFT_STEP = 4;
const RIGHT_FLOOR = 40; // g
// Time axis length before any shot exists, in seconds.
const EMPTY_X_MAX = 30;

// Rounds outward to one significant digit: -247.3 -> -300, 52 -> 60.
const niceBound = (value: number, direction: "down" | "up") => {
  if (value === 0) return 0;
  const step = 10 ** Math.floor(Math.log10(Math.abs(value)));
  const round = direction === "down" ? Math.floor : Math.ceil;
  return round(value / step) * step;
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
  const [hidden, setHidden] = useState<Metric[]>([]);

  const historyPoints = useMemo<ShotPoint[]>(
    () =>
      (lastShot.data?.data ?? []).map((point) => ({
        time: point.time / 1000,
        pressure: point.shot.pressure,
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
  const duration = points.length ? points[points.length - 1].time : 0;
  const finalWeight = points.length
    ? points[points.length - 1].weight
    : undefined;
  const profileName = showLive ? loadedProfile : lastShot.data?.profile?.name;

  useEffect(() => {
    if (!chart) return;
    const colors = chartColors();
    const axis = axisStyle(colors);
    // The time axis ends where the shot ends, rounded up to the next 5 s;
    // a live shot widens it as it runs.
    const xMax = points.length
      ? Math.max(10, Math.ceil(duration / 5) * 5)
      : EMPTY_X_MAX;
    const visible = SERIES.filter((series) => !hidden.includes(series.key));
    const yAxis = (
      floor: number,
      name: string,
      side: "left" | "right",
      step?: number,
    ) => ({
      type: "value",
      position: side,
      // An axis with all its series hidden goes away.
      show: visible.some((series) => series.axis === (side === "left" ? 0 : 1)),
      name,
      nameGap: 8,
      min: (extent: { min: number }) =>
        Number.isFinite(extent.min) && extent.min < 0
          ? step
            ? Math.floor(extent.min / step) * step
            : niceBound(extent.min, "down")
          : 0,
      max: (extent: { max: number }) =>
        Number.isFinite(extent.max) && extent.max > floor
          ? step
            ? Math.ceil(extent.max / step) * step
            : niceBound(extent.max, "up")
          : floor,
      ...(step ? { interval: step } : { splitNumber: 4 }),
      ...axis,
      nameTextStyle: {
        ...axis.nameTextStyle,
        align: side === "left" ? "left" : "right",
      },
      splitLine: { show: side === "left", lineStyle: axis.splitLine.lineStyle },
    });

    chart.setOption(
      {
        animation: false,
        grid: { left: 4, right: 4, top: 24, bottom: 4, containLabel: true },
        xAxis: {
          type: "value",
          min: 0,
          max: xMax,
          interval: xMax <= 20 ? 5 : 10,
          ...axis,
          splitLine: { show: false },
          axisLabel: {
            ...axis.axisLabel,
            formatter: (value: number) =>
              value === xMax ? `${value} s` : `${value}`,
          },
        },
        yAxis: [
          yAxis(LEFT_FLOOR, "bar · g/s", "left", LEFT_STEP),
          yAxis(RIGHT_FLOOR, "g", "right"),
        ],
        tooltip: {
          trigger: "axis",
          ...tooltipStyle(colors),
          axisPointer: {
            type: "line",
            lineStyle: { color: colors.ink3, width: 1 },
          },
          formatter: (
            params: { seriesId: string; value: [number, number] }[],
          ) => {
            const lines = params.filter((param) =>
              SERIES.some((series) => series.key === param.seriesId),
            );
            if (!lines.length) return "";
            const rows = lines
              .map(({ seriesId, value }) => {
                const series = SERIES.find((item) => item.key === seriesId)!;
                return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:2px;border-radius:2px;background:${colors.series[series.slot]}"></span>${series.label}</span><span>${formatValue(value[1])} ${series.unit}</span></div>`;
              })
              .join("");
            return `<div style="color:${colors.ink3};margin-bottom:4px">${formatValue(lines[0].value[0])} s</div>${rows}`;
          },
        },
        series: visible.flatMap((series) => {
          const color = colors.series[series.slot];
          const data = points.map((point) => [point.time, point[series.key]]);
          const last = data[data.length - 1];
          return [
            {
              id: series.key,
              type: "line",
              yAxisIndex: series.axis,
              data,
              showSymbol: false,
              smooth: 0.2,
              lineStyle: { width: 2, color, cap: "round", join: "round" },
              itemStyle: { color },
              areaStyle:
                series.key === "weight" ? { color, opacity: 0.1 } : undefined,
              emphasis: { disabled: true },
            },
            {
              // End dot with a ring in the page color.
              id: `${series.key}-end`,
              type: "line",
              yAxisIndex: series.axis,
              data: last ? [last] : [],
              symbol: "circle",
              symbolSize: 9,
              itemStyle: { color, borderColor: colors.canvas, borderWidth: 2 },
              lineStyle: { opacity: 0 },
              tooltip: { show: false },
              silent: true,
              z: 3,
            },
          ];
        }),
      },
      { notMerge: true },
    );
    // liveVersion: the live shot array is mutated in place.
  }, [chart, points, hidden, duration, theme, liveVersion]);

  return (
    <section aria-label="Shot chart" className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
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
        <ul className="-mr-1.5 flex flex-wrap" aria-label="Chart series">
          {SERIES.map((series) => {
            const on = !hidden.includes(series.key);
            return (
              <li key={series.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  title={`${on ? "Hide" : "Show"} ${series.label}${series.axis === 1 ? " (right axis)" : ""}`}
                  onClick={() =>
                    setHidden((current) =>
                      on
                        ? [...current, series.key]
                        : current.filter((key) => key !== series.key),
                    )
                  }
                  className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-raised ${
                    on
                      ? "text-ink-2"
                      : "text-ink-3 line-through decoration-ink-3/60"
                  }`}
                >
                  <span
                    className="h-0.5 w-3 shrink-0 rounded-full"
                    style={{
                      background: `var(--s${series.slot + 1})`,
                      opacity: on ? 1 : 0.35,
                    }}
                  />
                  {series.label}
                  <span className="text-ink-3">{series.unit}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="relative mt-1">
        <div ref={containerRef} className="h-[170px] w-full sm:h-[180px]" />
        {points.length === 0 && !lastShot.isLoading && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-3">
            No shot yet. Start one and it draws here.
          </p>
        )}
      </div>
    </section>
  );
};

import { useEffect, useState, type RefObject } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { cssVar } from "../../theme";

echarts.use([
  LineChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export type ChartInstance = echarts.ECharts;
export type ChartOption = echarts.EChartsCoreOption;

// Creates an ECharts instance on the element and keeps it sized to it.
export const useEChart = (ref: RefObject<HTMLDivElement | null>) => {
  const [chart, setChart] = useState<ChartInstance | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const instance = echarts.init(element, undefined, { renderer: "canvas" });
    setChart(instance);
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      instance.dispose();
      setChart(null);
    };
  }, [ref]);

  return chart;
};

// Concrete colors for the current theme (ECharts draws on a canvas and can't
// read CSS variables itself).
export const chartColors = () => ({
  canvas: cssVar("--canvas"),
  surface: cssVar("--chart-surface"),
  grid: cssVar("--chart-grid"),
  ink: cssVar("--ink"),
  ink2: cssVar("--ink-2"),
  ink3: cssVar("--ink-3"),
  line: cssVar("--line"),
  series: [1, 2, 3, 4, 5, 6, 7, 8].map((slot) => cssVar(`--s${slot}`)),
});

export type ChartColors = ReturnType<typeof chartColors>;

export const tooltipStyle = (colors: ChartColors) => ({
  backgroundColor: colors.surface,
  borderColor: colors.line,
  borderWidth: 1,
  padding: [8, 10],
  textStyle: { color: colors.ink, fontSize: 12, fontFamily: "ABC Diatype" },
  extraCssText: "border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.12);",
});

export const axisStyle = (colors: ChartColors) => ({
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: colors.ink3, fontSize: 11, fontFamily: "ABC Diatype" },
  splitLine: { lineStyle: { color: colors.grid, width: 1 } },
  nameTextStyle: {
    color: colors.ink3,
    fontSize: 11,
    fontFamily: "ABC Diatype",
  },
});

// "1.234" -> "1.2", keeping integers short.
export const formatValue = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined || Number.isNaN(value)
    ? "–"
    : value.toFixed(digits);

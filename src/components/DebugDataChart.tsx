import { useImperativeHandle, forwardRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";

type DebugDataChartProps = {
  maxPoints?: number; // Optional buffer size. If not set, data is stored indefinitely.
};
export type SensorDataPoint = Record<string, number | string>;

export type DebugDataChartRef = {
  clearData: () => void;
  pushData: (dataPoint: SensorDataPoint) => void;
};
const contrastColors = [
  "#e6194b",
  "#3cb44b",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#46f0f0",
  "#f032e6",
  "#bcf60c",
  "#fabebe",
  "#008080",
  "#e6beff",
  "#9a6324",
  "#fffac8",
  "#800000",
];

export const DebugDataChart = forwardRef<
  DebugDataChartRef,
  DebugDataChartProps
>(({ maxPoints = 0 }, ref) => {
  const [seriesData, setSeriesData] = useState<
    Record<string, (string | number)[]>
  >({});
  const [timeStamps, setTimeStamps] = useState<string[]>([]);

  useImperativeHandle(ref, () => ({
    clearData: () => {
      setSeriesData({});
      setTimeStamps([]);
    },
    pushData(dataPoint: SensorDataPoint) {
      const now = new Date().toLocaleTimeString();

      setTimeStamps((prev) => {
        const newTimestamps = [...prev, now];
        return maxPoints > 0 ? newTimestamps.slice(-maxPoints) : newTimestamps;
      });

      setSeriesData((prevData) => {
        const newData: Record<string, (number | string)[]> = { ...prevData };

        Object.entries(dataPoint).forEach(([key, value]) => {
          const series = newData[key] || [];
          const updated = [...series, value];
          newData[key] = maxPoints > 0 ? updated.slice(-maxPoints) : updated;
        });

        // Ensure missing series (not in current dataPoint) also maintain length
        Object.keys(prevData).forEach((key) => {
          if (!(key in dataPoint)) {
            const padded = [...prevData[key], NaN]; // Keep timeline alignment
            newData[key] = maxPoints > 0 ? padded.slice(-maxPoints) : padded;
          }
        });

        return newData;
      });
    },
  }));

  const options: echarts.EChartsOption = {
    animation: false,
    backgroundColor: "#272727", // dark background

    xAxis: {
      type: "category",
      data: timeStamps,
      boundaryGap: false,
      axisLine: { lineStyle: { color: "#ccc" } },
      axisLabel: { color: "#ccc" },
      splitLine: { show: true, lineStyle: { color: "#444" } },
    },
    yAxis: {
      type: "value",
      scale: true,
      axisLine: { lineStyle: { color: "#ccc" } },
      axisLabel: { color: "#ccc" },
      splitLine: { show: true, lineStyle: { color: "#444" } },
    },
    series: Object.entries(seriesData).map(([key, values], index) => ({
      name: key,
      type: "line",
      data: values,
      showSymbol: false,
      connectNulls: true,
      lineStyle: {
        width: 2,
      },
      color: contrastColors[index % contrastColors.length], // Custom color palette
    })),
    tooltip: {
      trigger: "axis",
      backgroundColor: "#333",
      textStyle: { color: "#fff" },
    },
    legend: {
      data: Object.keys(seriesData),
      textStyle: { color: "#fff" },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
  };

  return (
    <ReactECharts
      className="flex-1 2xl:min-w-auto sm:min-w-[550px] sm:w-auto min-w-full w-full"
      option={options}
      notMerge={true}
      lazyUpdate={true}
      opts={{ renderer: "canvas" }}
    />
  );
});
DebugDataChart.displayName = "DebugDataChart";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import ReactECharts from "echarts-for-react";
import { LineChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import type { ChartsConfig } from "../types/charts";
import { useSocketData } from "../contexts/SocketProvider";
import { useLastShot } from "../hooks/useHistory";
import type { HistoryDataPoint } from "@meticulous-home/espresso-api";

echarts.use([CanvasRenderer, LineChart]);
echarts.registerTheme("dark_theme", {
  backgroundColor: "#202020",
});

interface RealtimeChartProps {
  name:
    | "pressure-flow"
    | "gravFlow-weight"
    | "pressure"
    | "gravFlow"
    | "flow"
    | "weight";
  config: ChartsConfig;
  className?: string;
  height?: string;
  width?: string;
}

interface RealtimeDataPoint {
  time: number;
  sensors: {
    p: number;
    f: number;
    w: number;
    t: number;
    g: number;
  };
  extracting: boolean;
}

const updateChartData = (
  config: ChartsConfig,
  name: string,
  machineStatus: RealtimeDataPoint,
) => {
  const seconds = machineStatus.time / 1000.0;
  if (seconds > config.xAxis.max) config.xAxis.max = Math.floor(seconds);
  if (name === "pressure-flow") {
    config.series[0].data.push([seconds, machineStatus.sensors.p]);
    if (machineStatus.sensors.p > config.yAxis[0].max) {
      config.yAxis[0].max += 1;
    }
    config.series[1].data.push([seconds, machineStatus.sensors.f]);
    if (machineStatus.sensors.f > config.yAxis[1].max) {
      config.yAxis[1].max += 1;
    }
  }

  if (name === "gravFlow-weight") {
    config.series[0].data.push([seconds, machineStatus.sensors.g]);
    if (machineStatus.sensors.g > config.yAxis[0].max) {
      config.yAxis[0].max += 5;
    }
    config.series[1].data.push([seconds, machineStatus.sensors.w]);
    if (machineStatus.sensors.w > config.yAxis[1].max) {
      config.yAxis[1].max += 1;
    }
  }

  if (name === "flow") {
    config.series[0].data.push([seconds, machineStatus.sensors.f]);
    if (machineStatus.sensors.f > config.yAxis[0].max) {
      config.yAxis[0].max += 1;
    }
  }
  if (name === "pressure") {
    config.series[0].data.push([seconds, machineStatus.sensors.p]);
    if (machineStatus.sensors.p > config.yAxis[0].max) {
      config.yAxis[0].max += 1;
    }
  }
  if (name === "gravFlow") {
    config.series[0].data.push([seconds, machineStatus.sensors.g]);
    if (machineStatus.sensors.g > config.yAxis[0].max) {
      config.yAxis[0].max += 1;
    }
  }

  if (name === "weight") {
    config.series[0].data.push([seconds, machineStatus.sensors.w]);
    if (machineStatus.sensors.w > config.yAxis[0].max) {
      config.yAxis[0].max += 5;
    }
  }
  return config;
};

export const RealtimeChart = ({
  config,
  name,
  className,
  height,
  width,
}: RealtimeChartProps) => {
  const CHART_STYLES = { width: width ?? "100%", height: height ?? "260px" };
  const chartRef = useRef<ReactECharts | null>(null);
  const { status: machineStatus } = useSocketData();
  const { data: last_shot } = useLastShot();
  const lastMachineStatus = useRef(machineStatus);

  useEffect(() => {
    if (!machineStatus) {
      return;
    }
    if (!machineStatus.extracting) {
      return;
    }
    const instance = chartRef.current?.getEchartsInstance();

    // Clear the chart data if the machine was idle
    if (lastMachineStatus.current?.state === "idle") {
      config.series.forEach((_, index) => {
        config.series[index].data = [];
      });
      instance?.setOption({ ...config });
    }

    const new_config = updateChartData(config, name, machineStatus);
    if (new_config) {
      instance?.setOption({ ...new_config });
    }
    lastMachineStatus.current = machineStatus;
  }, [machineStatus]);

  useEffect(() => {
    if (!last_shot || machineStatus?.state !== "idle") {
      return;
    }
    const instance = chartRef.current?.getEchartsInstance();
    config.series.forEach((_, index) => {
      config.series[index].data = [];
    });
    last_shot.data.forEach((shot: HistoryDataPoint) => {
      const new_config = updateChartData(config, name, {
        sensors: {
          p: shot.shot.pressure,
          f: shot.shot.flow,
          w: shot.shot.weight,
          t: shot.shot.temperature,
          g: shot.shot.gravimetric_flow,
        },
        time: shot.time,
        extracting: true,
      } as RealtimeDataPoint);
      config = new_config || config;
    });
    instance?.setOption({ ...config });
  }, [last_shot, machineStatus]);

  return (
    <div className={`mb-2 ${className ?? ""}`}>
      <ReactECharts
        ref={(e) => {
          chartRef.current = e;
        }}
        style={CHART_STYLES}
        option={{
          xAxis: config.xAxis,
          yAxis: config.yAxis,
          series: config.series,
        }}
        theme={"dark_theme"}
      />
    </div>
  );
};

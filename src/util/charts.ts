import type { ChartsConfig, Serie } from "../types/charts";
import { chartColors } from "../types/global";

const image = "/circle.png";

export const pressureFlowCharts: ChartsConfig = {
  xAxis: {
    type: "value",
    axisTick: {
      show: false,
    },
    splitLine: {
      show: false,
    },
    min: 0,
    max: 10,
  },
  yAxis: [
    {
      type: "value",
      name: "Pressure",
      min: 0,
      max: 10,
      nameTextStyle: {
        color: chartColors.pressure,
      },
      axisLine: {
        show: false,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#6e7079", "#6e7079"],
        },
      },
    },
    {
      type: "value",
      name: "Flow",
      min: 0,
      max: 10,
      nameTextStyle: {
        color: chartColors.temperature,
      },
      axisLine: {
        show: false,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#6e7079", "#6e7079"],
        },
      },
    },
  ],
  series: [
    {
      lineStyle: {
        color: chartColors.pressure,
      },
      data: [],
      type: "line",
      yAxisIndex: 0,
      showSymbol: false,
      markLine: {
        silent: true,
        symbol: "none",
        label: {
          show: false,
        },
        lineStyle: {
          color: "#333",
        },
        data: [
          {
            yAxis: 1,
          },
          {
            yAxis: 3,
          },
          {
            yAxis: 5,
          },
          {
            yAxis: 7,
          },
          {
            yAxis: 9,
          },
        ],
      },
    },
    {
      lineStyle: {
        color: chartColors.temperature,
      },
      data: [],
      type: "line",
      yAxisIndex: 1,
      showSymbol: false,
    },
  ],
};

export const gravFlowWeightCharts: ChartsConfig = {
  xAxis: {
    type: "value",
    axisTick: {
      show: false,
    },
    splitLine: {
      show: false,
    },
    min: 0,
    max: 10,
  },
  yAxis: [
    {
      type: "value",
      name: "Grav. Flow",
      min: 0,
      max: 10,
      nameTextStyle: {
        color: chartColors.flow,
      },
      axisLine: {
        show: false,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#6e7079", "#6e7079"],
        },
      },
    },
    {
      type: "value",
      name: "Weight",
      min: 0,
      max: 40,
      nameTextStyle: {
        color: chartColors.weight,
      },
      axisLine: {
        show: false,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#6e7079", "#6e7079"],
        },
      },
    },
  ],
  series: [
    {
      lineStyle: {
        color: chartColors.flow,
      },
      data: [],
      type: "line",
      yAxisIndex: 0,
      showSymbol: false,
      markLine: {
        silent: true,
        symbol: "none",
        label: {
          show: false,
        },
        lineStyle: {
          color: "#333",
        },
        data: [
          {
            yAxis: 0.5,
          },
          {
            yAxis: 1.5,
          },
          {
            yAxis: 2.5,
          },
          {
            yAxis: 3.5,
          },
          {
            yAxis: 4.5,
          },
        ],
      },
    },
    {
      lineStyle: {
        color: chartColors.weight,
      },
      data: [],
      type: "line",
      yAxisIndex: 1,
      showSymbol: false,
    },
  ],
};

export const pressureChart: ChartsConfig = {
  xAxis: {
    type: "value",
    axisTick: {
      show: false,
    },
    splitLine: {
      show: false,
    },
    min: 0,
    max: 10,
  },
  yAxis: [
    {
      type: "value",
      name: "Pressure",
      min: 0,
      max: 10,
      nameTextStyle: {
        color: chartColors.pressure,
      },
      axisLine: {
        show: false,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#6e7079", "#6e7079"],
        },
      },
    },
  ],
  series: [
    {
      lineStyle: {
        color: chartColors.pressure,
      },
      data: [],
      type: "line",
      showSymbol: false,
      markLine: {
        silent: true,
        symbol: "none",
        label: {
          show: false,
        },
        lineStyle: {
          color: "#333",
        },
        data: [
          {
            yAxis: 1,
          },
          {
            yAxis: 3,
          },
          {
            yAxis: 5,
          },
          {
            yAxis: 7,
          },
          {
            yAxis: 9,
          },
        ],
      },
    },
  ],
};

export const gravFlowChart: ChartsConfig = {
  xAxis: {
    type: "value",
    axisTick: {
      show: false,
    },
    splitLine: {
      show: false,
    },
    min: 0,
    max: 10,
  },
  yAxis: [
    {
      type: "value",
      name: "Grav. Flow",
      min: 0,
      max: 5,
      nameTextStyle: {
        color: chartColors.grav_flow,
      },
      axisLine: {
        show: false,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#6e7079", "#6e7079"],
        },
      },
    },
  ],
  series: [
    {
      lineStyle: {
        color: chartColors.grav_flow,
      },
      data: [],
      type: "line",
      showSymbol: false,
    },
  ],
};

export const flowChart: ChartsConfig = {
  xAxis: {
    type: "value",
    axisTick: {
      show: false,
    },
    splitLine: {
      show: false,
    },
    min: 0,
    max: 10,
  },
  yAxis: [
    {
      type: "value",
      name: "Flow",
      min: 0,
      max: 10,
      nameTextStyle: {
        color: chartColors.flow,
      },
      axisLine: {
        show: false,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#6e7079", "#6e7079"],
        },
      },
    },
  ],
  series: [
    {
      lineStyle: {
        color: chartColors.flow,
      },
      data: [],
      type: "line",
      showSymbol: false,
      markLine: {
        silent: true,
        symbol: "none",
        label: {
          show: false,
        },
        lineStyle: {
          color: "#333",
        },
        data: [
          {
            yAxis: 0.5,
          },
          {
            yAxis: 1.5,
          },
          {
            yAxis: 2.5,
          },
          {
            yAxis: 3.5,
          },
          {
            yAxis: 4.5,
          },
        ],
      },
    },
  ],
};

export const weightChart: ChartsConfig = {
  xAxis: {
    type: "value",
    axisTick: {
      show: false,
    },
    splitLine: {
      show: false,
    },
    min: 0,
    max: 10,
  },
  yAxis: [
    {
      type: "value",
      name: "Weight",
      min: 0,
      max: 40,
      nameTextStyle: {
        color: chartColors.weight,
      },
      axisLine: {
        show: false,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#6e7079", "#6e7079"],
        },
      },
    },
  ],
  series: [
    {
      lineStyle: {
        color: chartColors.weight,
      },
      data: [],
      type: "line",
      showSymbol: false,
    },
  ],
};

export const configChart: Pick<ChartsConfig, "xAxis" | "yAxis" | "chartImg"> & {
  serie: Serie;
} = {
  chartImg: "",
  xAxis: {
    type: "value",
    axisTick: {
      show: false,
    },
    splitLine: {
      show: false,
    },
    min: 0,
    max: 10,
  },
  yAxis: [
    {
      type: "value",
      min: 1,
      max: 6,
      axisLine: {
        show: false,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#6e7079", "#6e7079"],
        },
      },
    },
    {
      type: "value",
      min: 1,
      max: 6,
      axisLine: {
        show: false,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#6e7079", "#6e7079"],
        },
      },
    },
  ],
  serie: {
    id: "a",
    animation: false,
    data: [
      [0, 3],
      [50, 3],
    ],
    symbol: `image://${image}`,
    symbolSize: 13,
    type: "line",
    itemStyle: {
      color: "#ff5845",
    },
    markLine: {
      silent: true,
      symbol: "none",
      label: {
        show: false,
      },
      lineStyle: {
        color: "#333",
      },
      data: [
        {
          yAxis: 0.5,
        },
        {
          yAxis: 1.5,
        },
        {
          yAxis: 2.5,
        },
        {
          yAxis: 3.5,
        },
        {
          yAxis: 4.5,
        },
        {
          yAxis: 5.5,
        },
      ],
    },
  },
};

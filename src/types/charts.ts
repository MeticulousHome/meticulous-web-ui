export interface ChartsConfig {
  xAxis: {
    min: number;
    max: number;
    type: "value";
    splitLine?: {
      show: boolean;
    };
    axisTick?: {
      show: boolean;
    };
  };
  yAxis: {
    name?: string;
    min: number;
    max: number;
    type: "value";
    color?: string;
    nameTextStyle?: {
      color: string;
    };
    axisLine?: {
      show: boolean;
    };
    splitLine?: {
      show: boolean;
      lineStyle: {
        color: string[];
      };
    };
  }[];
  series: Serie[];
  chartImg?: string;
}

export interface Serie {
  id?: string;
  animation?: boolean;
  symbol?: string;
  symbolSize?: number;
  itemStyle?: {
    color: string;
  };
  lineStyle?: {
    color: string;
  };
  showSymbol?: boolean;
  data: Array<Array<number>>;
  type: "line";
  yAxisIndex?: number;
  markLine?: {
    silent: boolean;
    symbol: "none";
    label?: {
      show: boolean;
    };
    lineStyle: {
      color: string;
    };
    data: {
      yAxis: number;
    }[];
  };
}

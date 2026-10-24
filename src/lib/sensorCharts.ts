// The six live sensor charts. The layout follows Xavi's "Log review" preset in
// ProfilePlotter (src/utils/presets.jsx): same groups, same axis split and the
// same Y ranges, mapped from shot-file field names to the live socket keys.
// Y ranges are a floor, not a clamp: an axis grows when a reading leaves it.
// Every key of the "sensors" socket message appears in one chart except
// w_stat (a boolean, shown in the raw readings table).

export type SeriesSource = "status" | "sensors";

export interface SensorSeries {
  key: string;
  source: SeriesSource;
  label: string;
  unit: string;
  axis: "left" | "right";
  // Hidden until switched on from the legend.
  hidden?: boolean;
  // A setpoint drawn dashed in the color of the series it targets.
  targetOf?: string;
  digits?: number;
}

export interface AxisDef {
  name: string;
  min: number;
  max: number;
}

export interface SensorChartDef {
  id: string;
  title: string;
  left: AxisDef;
  right?: AxisDef;
  series: SensorSeries[];
}

export const SENSOR_CHARTS: SensorChartDef[] = [
  {
    id: "extraction",
    title: "Extraction",
    left: { name: "bar · ml/s", min: 0, max: 12 },
    right: { name: "g · g/s", min: 0, max: 50 },
    series: [
      {
        key: "pressure",
        source: "status",
        label: "Pressure",
        unit: "bar",
        axis: "left",
      },
      {
        key: "flow",
        source: "status",
        label: "Flow",
        unit: "ml/s",
        axis: "left",
      },
      {
        key: "weight",
        source: "status",
        label: "Weight",
        unit: "g",
        axis: "right",
      },
      {
        key: "gravimetric_flow",
        source: "status",
        label: "Grav. flow",
        unit: "g/s",
        axis: "right",
      },
      {
        key: "setpoint_pressure",
        source: "status",
        label: "Pressure target",
        unit: "bar",
        axis: "left",
        targetOf: "pressure",
        hidden: true,
      },
      {
        key: "setpoint_flow",
        source: "status",
        label: "Flow target",
        unit: "ml/s",
        axis: "left",
        targetOf: "flow",
        hidden: true,
      },
      {
        key: "weight_pred",
        source: "sensors",
        label: "Weight prediction",
        unit: "g",
        axis: "right",
        hidden: true,
      },
    ],
  },
  {
    id: "group-temperatures",
    title: "Group temperatures",
    left: { name: "°C", min: 0, max: 100 },
    series: [
      {
        key: "t_bar_up",
        source: "sensors",
        label: "Bar up",
        unit: "°C",
        axis: "left",
      },
      {
        key: "t_bar_mu",
        source: "sensors",
        label: "Bar mid-up",
        unit: "°C",
        axis: "left",
      },
      {
        key: "t_bar_md",
        source: "sensors",
        label: "Bar mid-down",
        unit: "°C",
        axis: "left",
      },
      {
        key: "t_bar_down",
        source: "sensors",
        label: "Bar down",
        unit: "°C",
        axis: "left",
      },
      {
        key: "t_tube",
        source: "sensors",
        label: "Tube",
        unit: "°C",
        axis: "left",
      },
      {
        key: "setpoint_temperature",
        source: "status",
        label: "Temperature target",
        unit: "°C",
        axis: "left",
        targetOf: "t_tube",
      },
    ],
  },
  {
    id: "heater",
    title: "Heater",
    left: { name: "A", min: 0, max: 12 },
    right: { name: "°C · %", min: 0, max: 220 },
    series: [
      {
        key: "t_ext_1",
        source: "sensors",
        label: "External 1",
        unit: "°C",
        axis: "right",
      },
      {
        key: "t_ext_2",
        source: "sensors",
        label: "External 2",
        unit: "°C",
        axis: "right",
      },
      {
        key: "bh_pwr",
        source: "sensors",
        label: "Heater power",
        unit: "%",
        axis: "right",
      },
      {
        key: "bh_cur",
        source: "sensors",
        label: "Heater current",
        unit: "A",
        axis: "left",
        digits: 2,
      },
    ],
  },
  {
    id: "motor",
    title: "Motor",
    left: { name: "mm/s · A", min: 0, max: 12 },
    right: { name: "mm · %", min: 0, max: 100 },
    series: [
      {
        key: "m_pos",
        source: "sensors",
        label: "Position",
        unit: "mm",
        axis: "right",
      },
      {
        key: "m_spd",
        source: "sensors",
        label: "Speed",
        unit: "mm/s",
        axis: "left",
        digits: 2,
      },
      {
        key: "m_pwr",
        source: "sensors",
        label: "Power",
        unit: "%",
        axis: "right",
      },
      {
        key: "m_cur",
        source: "sensors",
        label: "Current",
        unit: "A",
        axis: "left",
        digits: 2,
      },
    ],
  },
  {
    id: "sample-rates",
    title: "Pressure sensor & ADC rates",
    left: { name: "samples/s", min: 0, max: 350 },
    series: [
      {
        key: "p",
        source: "sensors",
        label: "Pressure sensor",
        unit: "Hz",
        axis: "left",
        digits: 0,
      },
      {
        key: "a_0",
        source: "sensors",
        label: "ADC 0",
        unit: "Hz",
        axis: "left",
        digits: 0,
      },
      {
        key: "a_1",
        source: "sensors",
        label: "ADC 1",
        unit: "Hz",
        axis: "left",
        digits: 0,
      },
      {
        key: "a_2",
        source: "sensors",
        label: "ADC 2",
        unit: "Hz",
        axis: "left",
        digits: 0,
      },
      {
        key: "a_3",
        source: "sensors",
        label: "ADC 3",
        unit: "Hz",
        axis: "left",
        digits: 0,
      },
    ],
  },
  {
    id: "pressure-temperatures",
    title: "Pressure & electronics temperatures",
    left: { name: "bar", min: 0, max: 12 },
    right: { name: "°C", min: 0, max: 100 },
    series: [
      {
        key: "pressure",
        source: "status",
        label: "Pressure",
        unit: "bar",
        axis: "left",
      },
      {
        key: "t_motor_temp",
        source: "sensors",
        label: "Motor temp",
        unit: "°C",
        axis: "right",
      },
      {
        key: "motor_temp",
        source: "sensors",
        label: "Cup temp",
        unit: "°C",
        axis: "right",
      },
      {
        key: "lam_temp",
        source: "sensors",
        label: "LAM temp",
        unit: "°C",
        axis: "right",
      },
    ],
  },
];

// Friendly names for the raw "sensors" keys, for the readings table.
export const SENSOR_LABELS: Record<string, string> = {
  a_0: "ADC 0 rate",
  a_1: "ADC 1 rate",
  a_2: "ADC 2 rate",
  a_3: "ADC 3 rate",
  bh_cur: "Heater current",
  bh_pwr: "Heater power",
  lam_temp: "LAM temp",
  m_cur: "Motor current",
  m_pos: "Motor position",
  m_pwr: "Motor power",
  m_spd: "Motor speed",
  motor_temp: "Cup temp",
  p: "Pressure sensor rate",
  t_bar_down: "Bar down",
  t_bar_md: "Bar mid-down",
  t_bar_mu: "Bar mid-up",
  t_bar_up: "Bar up",
  t_ext_1: "External 1",
  t_ext_2: "External 2",
  t_motor_temp: "Motor temp",
  t_tube: "Tube",
  w_stat: "Weight stable",
  weight_pred: "Weight prediction",
};

export const SENSOR_UNITS: Record<string, string> = {
  a_0: "Hz",
  a_1: "Hz",
  a_2: "Hz",
  a_3: "Hz",
  bh_cur: "A",
  bh_pwr: "%",
  lam_temp: "°C",
  m_cur: "A",
  m_pos: "mm",
  m_pwr: "%",
  m_spd: "mm/s",
  motor_temp: "°C",
  p: "Hz",
  t_bar_down: "°C",
  t_bar_md: "°C",
  t_bar_mu: "°C",
  t_bar_up: "°C",
  t_ext_1: "°C",
  t_ext_2: "°C",
  t_motor_temp: "°C",
  t_tube: "°C",
  weight_pred: "g",
};

// Expected ranges, from ProfilePlotter's src/config/fieldRanges.json. A
// reading outside them is flagged in the readings table.
export const SENSOR_RANGES: Record<string, { min: number; max: number }> = {
  t_ext_1: { min: 10, max: 220 },
  t_ext_2: { min: 10, max: 220 },
  t_bar_up: { min: 10, max: 105 },
  t_bar_mu: { min: 10, max: 105 },
  t_bar_md: { min: 10, max: 105 },
  t_bar_down: { min: 10, max: 105 },
  t_tube: { min: 10, max: 105 },
  t_motor_temp: { min: 10, max: 50 },
  lam_temp: { min: 5, max: 40 },
  m_pos: { min: -0.1, max: 78 },
  m_spd: { min: -10, max: 10 },
  m_pwr: { min: -100, max: 100 },
  m_cur: { min: -3.5, max: 8 },
  bh_pwr: { min: 0, max: 100 },
  bh_cur: { min: 0, max: 5 },
  p: { min: 240, max: 340 },
  a_0: { min: 45, max: 53 },
  a_1: { min: 45, max: 53 },
  a_2: { min: 45, max: 53 },
  a_3: { min: 45, max: 53 },
};

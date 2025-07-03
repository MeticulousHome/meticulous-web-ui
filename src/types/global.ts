export type ChartType =
  | "pressure"
  | "temperature"
  | "power"
  | "flow"
  | "weight"
  | "grav_flow";

export const chartColors: Record<ChartType, string> = {
  pressure: "#78D6FF",
  temperature: "#ff5845",
  power: "#FDC352",
  flow: "#7BEEBF",
  weight: "#FDC352",
  grav_flow: "#EC835E",
};

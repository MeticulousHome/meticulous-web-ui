import { useEffect, useRef, useState } from "react";
import { useSocketData } from "../contexts/SocketProvider";
import { Text } from "./Text/Text";
import {
  DebugDataChart,
  type DebugDataChartRef,
  type SensorDataPoint,
} from "./DebugDataChart";

const DebugEntry = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="ms:w-1/3 min-w-[100px]">
      <div className="flex flex-col text-center">
        <div className="flex items-start justify-center">
          <Text
            label={value}
            className="text-white capitalize text-sm md:text-xl"
          />
        </div>
        <Text
          label={label}
          className="text-gray-secondary text-xs md:text-md"
        />
      </div>
    </div>
  );
};

type DebugDataType = { [key: string]: number | string };

const debugKeyLabels: Record<string, string> = {
  a_0: "ADC Rate 0",
  a_1: "ADC Rate 1",
  a_2: "ADC Rate 2",
  a_3: "ADC Rate 3",
  bh_cur: "Heater Current",
  bh_pwr: "Heater Setpoint",
  lam_temp: "LAM Temp",
  m_cur: "Motor Current",
  m_pos: "Motor Position",
  m_pwr: "Motor Setpoint",
  m_spd: "Motor Speed",
  motor_temp: "Motor Temp",
  p: "Pressure Sensor Rate",
  t_bar_down: "Bar Down",
  t_bar_md: "Bar Mid",
  t_bar_mu: "Bar Mid Up",
  t_bar_up: "Bar Up",
  t_ext_1: "Heater External Temp 1",
  t_ext_2: "Heater External Temp 2",
  t_motor_temp: "Motor Thermistor",
  t_tube: "Tube Temp",
  w_stat: "Weight Stable",
  weight_pred: "Weight Prediction",
};
export const DebugData = () => {
  const { sensors: debugData } = useSocketData() as { sensors: DebugDataType };
  const [showDebug, setShowDebug] = useState(false);
  const temperatureChartRef = useRef<DebugDataChartRef>(null);
  const motorChartRef = useRef<DebugDataChartRef>(null);
  const powerChartRef = useRef<DebugDataChartRef>(null);
  const miscCartRef = useRef<DebugDataChartRef>(null);
  const [recordAllData, setRecordAllData] = useState(false);
  const [pausePlotting, setPausePlotting] = useState(false);

  useEffect(() => {
    if (!pausePlotting) {
      temperatureChartRef.current?.clearData();
      motorChartRef.current?.clearData();
      powerChartRef.current?.clearData();
      miscCartRef.current?.clearData();
    }
  }, [pausePlotting]);

  useEffect(() => {
    if (!debugData || pausePlotting) {
      return;
    }
    const temperatureData: SensorDataPoint = {};
    const motorData: SensorDataPoint = {};
    const powerData: SensorDataPoint = {};
    const miscData: SensorDataPoint = {};
    Object.entries(debugData).forEach(([key, value]) => {
      const label = debugKeyLabels[key] ? debugKeyLabels[key] : key;
      if (key.startsWith("t_") || key.endsWith("_temp")) {
        if (typeof value == "number" && value >= 200) {
          temperatureData[label] = NaN;
        } else {
          temperatureData[label] = value;
        }
      } else if (key.startsWith("m_")) {
        motorData[label] = value;
      } else if (key.startsWith("bh_")) {
        powerData[label] = value;
      } else {
        miscData[label] = value;
      }
    });
    temperatureChartRef.current?.pushData(temperatureData);
    motorChartRef.current?.pushData(motorData);
    powerChartRef.current?.pushData(powerData);
    miscCartRef.current?.pushData(miscData);
  }, [debugData, pausePlotting]);

  return (
    <footer className="flex flex-col w-full row justify-center items-center py-2">
      {showDebug && (
        <div className="mt-8 w-full p-2" style={{ backgroundColor: "#212121" }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Object.keys(debugData || {}).map((key) => (
              <DebugEntry
                key={key}
                label={debugKeyLabels[key] ? debugKeyLabels[key] : key}
                value={debugData[key].toString()}
              />
            ))}
          </div>
          <div className="w-full flex justify-center items-center gap-3">
            <button
              className="p-2 border-2 border-gray-300 rounded-md shadow-sm mt-2 text-gray-300"
              onClick={() => setRecordAllData((prev) => !prev)}
            >
              {recordAllData
                ? "Plotting indefinetely"
                : "Plotting the last minute"}
            </button>
            <button
              className="p-2 border-2 border-gray-300 rounded-md shadow-sm mt-2 text-gray-300"
              onClick={() => setPausePlotting((prev) => !prev)}
            >
              {pausePlotting
                ? "Click to resume plotting"
                : "Click to pause plotting"}
            </button>
          </div>
          <div className="flex flex-row flex-wrap md:gap-4 mt-4 w-full">
            <DebugDataChart
              ref={temperatureChartRef}
              maxPoints={recordAllData ? 0 : 600}
            />
            <DebugDataChart
              ref={motorChartRef}
              maxPoints={recordAllData ? 0 : 600}
            />
            <DebugDataChart
              ref={powerChartRef}
              maxPoints={recordAllData ? 0 : 600}
            />
            <DebugDataChart
              ref={miscCartRef}
              maxPoints={recordAllData ? 0 : 600}
            />
          </div>
        </div>
      )}
      <div className="w-full flex justify-center items-center fixed bottom-2">
        <button
          className="p-2 border-2 border-gray-300 rounded-md shadow-sm mt-2 text-gray-300"
          onClick={() => setShowDebug((prev) => !prev)}
        >
          {showDebug ? "Hide raw sensor data" : "Show raw sensor data"}
        </button>
      </div>
    </footer>
  );
};

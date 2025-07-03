import { useSocketData } from "../contexts/SocketProvider";
import { Text } from "./Text/Text";

const StatusEntry = ({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) => {
  return (
    <div className="ms:w-1/3 min-w-[100px]">
      <div className="flex flex-col text-center">
        <div className="flex items-start justify-center">
          <Text
            label={value}
            className="text-white capitalize text-sm md:text-xl"
          />
          {unit && <div className="unit ml-1 md:text-xs">{unit}</div>}
        </div>
        <Text
          label={label}
          className="text-gray-secondary text-xs md:text-md"
        />
      </div>
    </div>
  );
};

export const StatusLine = () => {
  const { status: machineStatus } = useSocketData();

  const {
    // t: temperature = 0,
    p: pressure = 0,
    w: weight = 0,
    f: flow = 0,
    g: grav_flow = 0,
  } = machineStatus?.sensors || {};

  return (
    <div className="flex flex-wrap w-full justify-around mt-8 md:gap-0.5">
      <StatusEntry
        label="Status"
        value={machineStatus?.name || "Disconnected"}
      />
      <StatusEntry label="Pressure" value={pressure.toFixed(1)} unit="bar" />
      <StatusEntry label="Flow" value={flow.toFixed(1)} unit="ml/s" />
      <StatusEntry label="Weight" value={weight.toFixed(1)} unit="g" />
      <StatusEntry label="Grav. Flow" value={grav_flow.toFixed(1)} unit="g/s" />
    </div>
  );
};

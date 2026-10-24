import { useLiveStatus, useMachine } from "../../contexts/MachineProvider";

const Tile = ({
  value,
  unit,
  label,
  detail,
}: {
  value: string;
  unit?: string;
  label: string;
  detail?: string;
}) => (
  <div className="flex min-w-0 flex-col items-center justify-center px-2 py-1 text-center">
    <div className="flex max-w-full items-start">
      {/* Long values ("-246.9", "Preinfusion") step down a size to fit. */}
      <span
        className={`truncate leading-none tracking-[-0.02em] text-ink capitalize ${
          value.length > 5
            ? "text-[26px] sm:text-[32px] xl:text-[36px]"
            : "text-[34px] sm:text-[40px] xl:text-[44px]"
        }`}
      >
        {value}
      </span>
      {unit && (
        <span className="ml-1 text-base leading-none text-ink-2">{unit}</span>
      )}
    </div>
    <span className="mt-2 text-sm text-ink-2 sm:text-base">
      {label}
      {detail && <span className="text-ink-3"> · {detail}</span>}
    </span>
  </div>
);

const formatNumber = (value: number | undefined, digits = 1) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "–";

export const StatusTiles = () => {
  const status = useLiveStatus();
  const { connection } = useMachine();
  const sensors = status?.sensors;
  const targetTemperature = status?.setpoints?.temperature;

  const statusName =
    connection !== "connected"
      ? connection === "connecting"
        ? "…"
        : "Offline"
      : (status?.name ?? "…");

  return (
    <div className="grid grid-cols-3 divide-x divide-line">
      <Tile
        value={statusName}
        label="Status"
        detail={
          status?.extracting
            ? `${(status.time / 1000).toFixed(1)} s`
            : undefined
        }
      />
      <Tile value={formatNumber(sensors?.w)} unit="g" label="Weight" />
      <Tile
        value={formatNumber(sensors?.t)}
        unit="°C"
        label="Temp."
        detail={
          typeof targetTemperature === "number"
            ? `→ ${targetTemperature.toFixed(0)}°`
            : undefined
        }
      />
    </div>
  );
};

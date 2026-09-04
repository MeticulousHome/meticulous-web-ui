import { useState } from "react";
import { WATCHER_URL } from "../api/api";
import { useDevice } from "../hooks/useDevice";
import { BottomModal } from "./Settings/BottomModal";

const LOG_SERVICES = [
  { value: "meticulous-backend", label: "Machine backend" },
  { value: "meticulous-dial", label: "Dial" },
  { value: "meticulous-watcher", label: "System watcher" },
  { value: "rauc-hawkbit-updater", label: "Software updates" },
  { value: "NetworkManager", label: "Network" },
  { value: "nginx", label: "Web server" },
  { value: "meticulous-rauc", label: "Update coordination" },
  { value: "pulseaudio", label: "Audio" },
];

type RangeMode = "hours" | "date" | "range";

interface LogDownloadProps {
  isOpen: boolean;
  onClose: () => void;
}

const localDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateRange = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  return { start, end };
};

const dateTime = (date: string, time: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
};

export const LogDownload = ({ isOpen, onClose }: LogDownloadProps) => {
  const { device } = useDevice();
  const [rangeMode, setRangeMode] = useState<RangeMode>("hours");
  const [hours, setHours] = useState(24);
  const [date, setDate] = useState(localDate);
  const [rangeStart, setRangeStart] = useState(localDate);
  const [rangeEnd, setRangeEnd] = useState(localDate);
  const [usePreciseTimes, setUsePreciseTimes] = useState(false);
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [allServices, setAllServices] = useState(true);
  const [services, setServices] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleService = (service: string) => {
    setAllServices(false);
    setServices((selected) =>
      selected.includes(service)
        ? selected.filter((item) => item !== service)
        : [...selected, service],
    );
  };

  const handleDownload = async () => {
    setError(null);

    if (!allServices && services.length === 0) {
      setError("Select at least one service, or choose all services.");
      return;
    }
    if (rangeMode === "hours" && (!Number.isFinite(hours) || hours < 1)) {
      setError("Hours must be at least 1.");
      return;
    }
    if (rangeMode === "date" && !date) {
      setError("Choose a date.");
      return;
    }
    if (rangeMode === "range") {
      if (!rangeStart || !rangeEnd) {
        setError("Choose both a start date and an end date.");
        return;
      }
      if (rangeStart > rangeEnd) {
        setError("The start date must be before the end date.");
        return;
      }
      if (usePreciseTimes) {
        const start = dateTime(rangeStart, startTime);
        const end = dateTime(rangeEnd, endTime);
        end.setMinutes(end.getMinutes() + 1);
        if (start >= end) {
          setError("The start time must be before the end time.");
          return;
        }
      }
    }

    setIsDownloading(true);
    try {
      const url = new URL(`${WATCHER_URL}/logs`);
      if (allServices) {
        url.searchParams.append("filter", "*");
      } else {
        services.forEach((service) =>
          url.searchParams.append("filter", service),
        );
      }

      let filename: string;
      if (rangeMode === "hours") {
        url.searchParams.set("hours", String(hours));
        filename = `machine-journal-last-${hours}-hours.log`;
      } else if (rangeMode === "date") {
        const { start, end } = dateRange(date);
        url.searchParams.set("start", start.toISOString());
        url.searchParams.set("end", end.toISOString());
        filename = `machine-journal-${date}.log`;
      } else {
        let start: Date;
        let end: Date;
        if (usePreciseTimes) {
          start = dateTime(rangeStart, startTime);
          end = dateTime(rangeEnd, endTime);
          // Include the complete minute selected in the "Through" field.
          end.setMinutes(end.getMinutes() + 1);
        } else {
          start = dateRange(rangeStart).start;
          end = dateRange(rangeEnd).end;
        }
        url.searchParams.set("start", start.toISOString());
        url.searchParams.set("end", end.toISOString());
        filename = `machine-journal-${rangeStart}-to-${rangeEnd}.log`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          (await response.text()) || `Request failed (${response.status})`,
        );
      }

      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download logs.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <BottomModal
      orientation={device === "MOBILE" ? "vertical" : "horizontal"}
      isOpen={isOpen}
      onClose={onClose}
    >
      <h1 className="mb-2 text-3xl">Download machine logs</h1>
      <p className="mb-6 text-sm text-gray-300">
        Logs are redacted on the machine before the file is downloaded.
      </p>

      <fieldset className="mb-6">
        <legend className="mb-3 text-xl">Time range</legend>
        <label className="mb-3 flex items-center gap-2">
          <input
            type="radio"
            name="log-range"
            checked={rangeMode === "hours"}
            onChange={() => setRangeMode("hours")}
          />
          Last
          <input
            type="number"
            min="1"
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
            disabled={rangeMode !== "hours"}
            className="w-24 rounded-md border border-gray-500 bg-gray-800 p-2 disabled:opacity-50"
          />
          hours
        </label>
        <label className="mb-3 flex items-center gap-2">
          <input
            type="radio"
            name="log-range"
            checked={rangeMode === "date"}
            onChange={() => setRangeMode("date")}
          />
          Specific date
          <input
            type="date"
            value={date}
            max={localDate()}
            onChange={(event) => setDate(event.target.value)}
            disabled={rangeMode !== "date"}
            className="rounded-md border border-gray-500 bg-gray-800 p-2 disabled:opacity-50"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="log-range"
            checked={rangeMode === "range"}
            onChange={() => setRangeMode("range")}
          />
          Date range
        </label>
        {rangeMode === "range" && (
          <div className="mt-3 ml-6 rounded-md border border-gray-600 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-200">
                From date
                <input
                  type="date"
                  value={rangeStart}
                  max={localDate()}
                  onChange={(event) => {
                    const nextStart = event.target.value;
                    setRangeStart(nextStart);
                    if (rangeEnd < nextStart) setRangeEnd(nextStart);
                  }}
                  className="rounded-md border border-gray-500 bg-gray-800 p-2 text-base"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-200">
                Through date
                <input
                  type="date"
                  value={rangeEnd}
                  min={rangeStart}
                  max={localDate()}
                  onChange={(event) => setRangeEnd(event.target.value)}
                  className="rounded-md border border-gray-500 bg-gray-800 p-2 text-base"
                />
              </label>
            </div>
            <label className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={usePreciseTimes}
                onChange={(event) => setUsePreciseTimes(event.target.checked)}
              />
              Select specific times
            </label>
            {usePreciseTimes && (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-gray-200">
                  From time
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="rounded-md border border-gray-500 bg-gray-800 p-2 text-base"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-200">
                  Through time
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="rounded-md border border-gray-500 bg-gray-800 p-2 text-base"
                  />
                </label>
              </div>
            )}
            <p className="mt-3 text-xs text-gray-400">
              {usePreciseTimes
                ? "The selected end minute is included."
                : "Both selected days are included in full."}
            </p>
          </div>
        )}
      </fieldset>

      <fieldset className="mb-6">
        <legend className="mb-3 text-xl">Services</legend>
        <label className="mb-3 flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={allServices}
            onChange={(event) => {
              setAllServices(event.target.checked);
              if (event.target.checked) setServices([]);
            }}
          />
          All services
        </label>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {LOG_SERVICES.map((service) => (
            <label key={service.value} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!allServices && services.includes(service.value)}
                onChange={() => toggleService(service.value)}
              />
              {service.label}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="rounded-md border-2 border-gray-300 bg-green-950 p-3 text-lg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDownloading ? "Preparing log file..." : "Download logs"}
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </BottomModal>
  );
};

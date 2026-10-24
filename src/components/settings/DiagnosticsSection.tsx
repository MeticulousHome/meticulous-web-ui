import { useState } from "react";
import { Archive, Download } from "lucide-react";
import { useMachine } from "../../contexts/MachineProvider";
import { saveBlob } from "../../lib/download";
import { Button } from "../ui/Button";
import { Segmented } from "../ui/Segmented";
import { SettingRow, SettingsCard } from "./fields";

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

const fieldClass =
  "h-9 rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink focus:border-ink-2 focus:outline-none disabled:opacity-50";

const LogDownload = () => {
  const { watcherUrl } = useMachine();
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
      const url = new URL(`${watcherUrl}/logs`);
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
      saveBlob(await response.blob(), filename);
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
    <SettingsCard
      title="Machine logs"
      description="The system journal, redacted on the machine before it downloads."
    >
      <div className="flex flex-col gap-5 px-5 py-4">
        <div className="flex flex-col gap-3">
          <span className="text-sm text-ink-2">Time range</span>
          <Segmented<RangeMode>
            label="Time range"
            value={rangeMode}
            onChange={setRangeMode}
            options={[
              { value: "hours", label: "Last hours" },
              { value: "date", label: "One day" },
              { value: "range", label: "Date range" },
            ]}
          />
          {rangeMode === "hours" && (
            <label className="flex items-center gap-2 text-sm text-ink">
              Last
              <input
                type="number"
                min="1"
                value={hours}
                onChange={(event) => setHours(Number(event.target.value))}
                className={`${fieldClass} w-24`}
              />
              hours
            </label>
          )}
          {rangeMode === "date" && (
            <input
              type="date"
              aria-label="Date"
              value={date}
              max={localDate()}
              onChange={(event) => setDate(event.target.value)}
              className={`${fieldClass} w-48`}
            />
          )}
          {rangeMode === "range" && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-ink-2">
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
                    className={fieldClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-2">
                  Through date
                  <input
                    type="date"
                    value={rangeEnd}
                    min={rangeStart}
                    max={localDate()}
                    onChange={(event) => setRangeEnd(event.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={usePreciseTimes}
                  onChange={(event) => setUsePreciseTimes(event.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                Select specific times
              </label>
              {usePreciseTimes && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-ink-2">
                    From time
                    <input
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-ink-2">
                    Through time
                    <input
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                </div>
              )}
              <p className="text-xs text-ink-3">
                {usePreciseTimes
                  ? "The selected end minute is included."
                  : "Both selected days are included in full."}
              </p>
            </div>
          )}
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm text-ink-2">Services</legend>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={allServices}
              onChange={(event) => {
                setAllServices(event.target.checked);
                if (event.target.checked) setServices([]);
              }}
              className="size-4 accent-[var(--accent)]"
            />
            All services
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {LOG_SERVICES.map((service) => (
              <label
                key={service.value}
                className="flex items-center gap-2 text-sm text-ink-2"
              >
                <input
                  type="checkbox"
                  checked={!allServices && services.includes(service.value)}
                  onChange={() => toggleService(service.value)}
                  className="size-4 accent-[var(--accent)]"
                />
                {service.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={handleDownload}
            loading={isDownloading}
          >
            {!isDownloading && <Download size={16} />}
            {isDownloading ? "Preparing log file…" : "Download logs"}
          </Button>
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>
      </div>
    </SettingsCard>
  );
};

const SystemArchive = () => {
  const { watcherUrl } = useMachine();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${watcherUrl}/archive`);
      if (!response.ok) {
        throw new Error(`Archive request failed: ${response.statusText}`);
      }
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
      saveBlob(
        await response.blob(),
        filenameMatch?.[1] ?? "meticulous_archive.zip",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to download archive");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsCard>
      <SettingRow
        label="System archive"
        description={
          error ? (
            <span className="text-bad">{error}</span>
          ) : (
            "Logs, settings and recent shots in one zip, for support."
          )
        }
      >
        <Button variant="secondary" onClick={download} loading={loading}>
          {!loading && <Archive size={16} />}
          {loading ? "Preparing archive…" : "Download archive"}
        </Button>
      </SettingRow>
    </SettingsCard>
  );
};

export const DiagnosticsSection = () => (
  <div className="flex flex-col gap-6">
    <LogDownload />
    <SystemArchive />
  </div>
);

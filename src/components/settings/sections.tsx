import { useId, useMemo } from "react";
import { TriangleAlert } from "lucide-react";
import { CAN_CHANGE_MACHINE } from "../../api/api";
import { useMachine } from "../../contexts/MachineProvider";
import { useDeviceInfo, useSettings } from "../../hooks/useMachineData";
import {
  RETRACTION_MAX_ML,
  RETRACTION_MIN_ML,
  retractionMlToMm,
  retractionMmToMl,
} from "../../lib/retraction";
import { useThemePreference, type ThemePreference } from "../../theme";
import { MachineAddressForm } from "../connection/MachineAddressForm";
import { Segmented } from "../ui/Segmented";
import { Switch } from "../ui/Switch";
import {
  LockedSetting,
  NumberSetting,
  SelectSetting,
  SettingRow,
  SettingsCard,
  TextSetting,
  ToggleSetting,
} from "./fields";
import { UpdateChannelSetting } from "./UpdateChannelSetting";
import { useSettingSaver } from "./useSettingSaver";

export const MachineSection = () => {
  const { machineUrl, connection } = useMachine();
  const { data: info, error } = useDeviceInfo();
  const [theme, setTheme] = useThemePreference();

  const rows: [string, unknown][] = info
    ? [
        ["Name", info.name],
        ["Serial", info.serial],
        ["Hostname", info.hostname],
        ["Color", info.color],
        [
          "Mains voltage",
          info.mainVoltage ? `${info.mainVoltage} V` : undefined,
        ],
        ["Firmware", info.firmware],
        ["Software", info.software_version],
        [
          "Image",
          [info.image_version, info.image_build_channel]
            .filter(Boolean)
            .join(" · "),
        ],
        ["Batch", info.batch_number],
        ["Build date", info.build_date],
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Served by the machine, the page always shows that machine; only the
          dev server can point it at another one. */}
      {CAN_CHANGE_MACHINE && (
        <SettingsCard
          title="Connection"
          description={
            <>
              Development only. This page talks to{" "}
              <span className="font-mono">
                {machineUrl.replace(/^https?:\/\//, "")}
              </span>{" "}
              ({connection}).
            </>
          }
        >
          <div className="p-5">
            <MachineAddressForm />
          </div>
        </SettingsCard>
      )}

      <SettingsCard title="Machine info">
        {error ? (
          <p className="px-5 py-4 text-sm text-ink-2">{error.message}</p>
        ) : (
          <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-6 gap-y-2.5 px-5 py-4 text-sm">
            {rows
              .filter(
                ([, value]) =>
                  value !== undefined && value !== null && value !== "",
              )
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-2">{label}</dt>
                  <dd className="min-w-0 font-mono text-[13px] break-all text-ink">
                    {String(value)}
                  </dd>
                </div>
              ))}
          </dl>
        )}
      </SettingsCard>

      <SettingsCard title="Appearance">
        <SettingRow label="Theme" description="Applies to this browser only.">
          <Segmented<ThemePreference>
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
          />
        </SettingRow>
      </SettingsCard>
    </div>
  );
};

// Retraction as a water volume, 80 to 150 ml like the Dial, saved as the
// piston travel in mm the backend stores.
const RetractionSetting = () => {
  const { data } = useSettings();
  const save = useSettingSaver();
  const id = useId();
  const mm = data?.partial_retraction;
  const ml = typeof mm === "number" ? retractionMmToMl(mm) : undefined;
  const options = useMemo(() => {
    const volumes: number[] = [];
    for (let v = RETRACTION_MIN_ML; v <= RETRACTION_MAX_ML; v++)
      volumes.push(v);
    if (ml !== undefined && !volumes.includes(ml)) volumes.push(ml);
    return volumes.sort((a, b) => a - b);
  }, [ml]);

  return (
    <SettingRow
      label="Retraction distance"
      description="How far the piston pulls back, as the volume of water it moves."
      htmlFor={id}
    >
      <div className="flex items-center gap-3">
        <select
          id={id}
          value={ml ?? ""}
          disabled={ml === undefined}
          onChange={(event) =>
            save(
              {
                partial_retraction: retractionMlToMm(
                  Number(event.target.value),
                ),
              },
              "Retraction distance",
            )
          }
          className="h-9 w-28 rounded-lg border border-line-strong bg-canvas px-3 pr-8 text-sm text-ink focus:border-ink-2 focus:outline-none disabled:opacity-50"
        >
          {options.map((volume) => (
            <option key={volume} value={volume}>
              {volume} ml
            </option>
          ))}
        </select>
        <span className="w-20 font-mono text-xs text-ink-3">
          {typeof mm === "number" ? `${mm.toFixed(2)} mm` : ""}
        </span>
      </div>
    </SettingRow>
  );
};

export const BrewingSection = () => {
  const { data } = useSettings();
  return (
    <SettingsCard>
      <ToggleSetting
        settingKey="enable_sounds"
        label="Sounds"
        description="Play sounds on the machine."
      />
      <ToggleSetting
        settingKey="auto_start_shot"
        label="Auto start shot"
        description="Start the shot as soon as the profile is ready."
      />
      <ToggleSetting
        settingKey="auto_purge_after_shot"
        label="Auto purge after shot"
        description="Flush the group when a shot ends."
      />
      <NumberSetting
        settingKey="heating_timeout"
        label="Preheat timeout"
        description="Stop preheating after this long without a shot."
        suffix="min"
        min={0}
      />
      {data && "tare_behavior" in data && (
        <SelectSetting
          settingKey="tare_behavior"
          label="Auto tare"
          description="Zero the scale before or after the piston retracts."
          options={[
            { value: "after_retraction", label: "After retraction" },
            { value: "before_retraction", label: "Before retraction" },
          ]}
        />
      )}
      {data && "partial_retraction" in data && <RetractionSetting />}
    </SettingsCard>
  );
};

const REVERSE_SCROLLING = [
  { key: "home", label: "Home screen" },
  { key: "keyboard", label: "Circular keyboard" },
  { key: "menus", label: "Context menus" },
] as const;

const ReverseScrollingToggle = ({
  field,
  label,
}: {
  field: (typeof REVERSE_SCROLLING)[number]["key"];
  label: string;
}) => {
  const { data } = useSettings();
  const save = useSettingSaver();
  const id = useId();
  const current = data?.reverse_scrolling;
  return (
    <SettingRow label={label} htmlFor={id}>
      <Switch
        id={id}
        checked={current?.[field] === true}
        disabled={!current}
        onChange={(checked) =>
          current &&
          save(
            { reverse_scrolling: { ...current, [field]: checked } },
            "Reverse scrolling",
          )
        }
      />
    </SettingRow>
  );
};

// The idle screens the Dial offers (meticulous-dial IdleScreenSetting.tsx).
const IDLE_SCREENS = [
  { value: "default", label: "Analog clock" },
  { value: "digital", label: "Digital clock" },
  { value: "metCat", label: "Digital cat clock" },
  { value: "dvd", label: "DVD style" },
];

export const DialSection = () => (
  <div className="flex flex-col gap-6">
    <SettingsCard
      title="Reverse scrolling"
      description="Turn the dial the other way in these places."
    >
      {REVERSE_SCROLLING.map((item) => (
        <ReverseScrollingToggle
          key={item.key}
          field={item.key}
          label={item.label}
        />
      ))}
    </SettingsCard>
    <SettingsCard title="Display">
      <SelectSetting
        settingKey="idle_screen"
        label="Idle screen"
        description="What the dial shows while idle."
        options={IDLE_SCREENS}
      />
      <ToggleSetting
        settingKey="clock_format_24_hour"
        label="24-hour clock"
        description="Show times as 14:30 instead of 2:30 PM."
      />
    </SettingsCard>
  </div>
);

const timeZones = () => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
};

const TimeZoneSettings = () => {
  const { data } = useSettings();
  const zones = useMemo(timeZones, []);
  const automatic = data?.timezone_sync === "automatic";
  return (
    <>
      <SelectSetting
        settingKey="timezone_sync"
        label="Time zone detection"
        description="Automatic looks the zone up from the machine’s internet address. It sets the system time zone, used by the Dial clock and shot history."
        options={[
          { value: "automatic", label: "Automatic" },
          { value: "manual", label: "Manual" },
        ]}
      />
      <SelectSetting
        settingKey="time_zone"
        label="Time zone"
        description={
          automatic
            ? "Set automatically. Switch to Manual to pick one."
            : undefined
        }
        disabled={automatic}
        options={zones.map((zone) => ({
          value: zone,
          label: zone.replace(/_/g, " "),
        }))}
      />
    </>
  );
};

export const SystemSection = () => {
  const { data } = useSettings();
  return (
    <SettingsCard>
      <NumberSetting
        settingKey="debug_shot_data_retention_days"
        label="Debug data retention"
        description="Debug shot files older than this are deleted."
        suffix="days"
        min={0}
      />
      <UpdateChannelSetting />
      <TimeZoneSettings />
      <ToggleSetting
        settingKey="ssh_enabled"
        label="SSH"
        description="Allow SSH logins to the machine."
      />
      {data && "usb_mode" in data && (
        <SelectSetting
          settingKey="usb_mode"
          label="USB mode"
          description="How the machine’s USB port behaves."
          options={[
            { value: "host", label: "Host (drives, accessories)" },
            { value: "client", label: "Client (network over USB)" },
            { value: "dual_role", label: "Dual role" },
          ]}
        />
      )}
      {data && "report_contact_mail" in data && (
        <TextSetting
          settingKey="report_contact_mail"
          label="Report contact email"
          description="Where support can reply about problem reports sent from this machine."
          nullable
        />
      )}
      {data && "hostname_override" in data && (
        <LockedSetting
          label="Hostname override"
          value={
            typeof data.hostname_override === "string"
              ? data.hostname_override
              : "Not set"
          }
          description="Can’t be changed from this page."
        />
      )}
      {data && "telemetry_service_enabled" in data && (
        <ToggleSetting
          settingKey="telemetry_service_enabled"
          label="Telemetry service"
        />
      )}
    </SettingsCard>
  );
};

// Keys with their own control in the sections above.
const DEDICATED_KEYS = new Set([
  "enable_sounds",
  "auto_start_shot",
  "auto_purge_after_shot",
  "heating_timeout",
  "tare_behavior",
  "partial_retraction",
  "reverse_scrolling",
  "idle_screen",
  "clock_format_24_hour",
  "debug_shot_data_retention_days",
  "update_channel",
  "timezone_sync",
  "time_zone",
  "ssh_enabled",
  "usb_mode",
  "report_contact_mail",
  "hostname_override",
  "telemetry_service_enabled",
  "profile_order",
]);

// What a key does, where we know; otherwise the row shows the raw key.
const ADVANCED_NOTES: Record<string, string> = {
  disable_ui_features:
    "Not used by the current backend or Dial; the machine only stores it.",
};

const humanize = (key: string) => {
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const AdvancedSection = () => {
  const { data, isLoading } = useSettings();
  const entries = Object.entries(data ?? {})
    .filter(([key]) => !DEDICATED_KEYS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-6">
      <div
        role="note"
        className="flex gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-5 py-4"
      >
        <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" />
        <div className="text-sm">
          <p className="text-ink">Change these only if you know what they do</p>
          <p className="mt-1 text-ink-2">
            These settings control low-level machine behavior and are saved as
            soon as you change them. A wrong value can turn off features or
            affect how the machine brews.
          </p>
        </div>
      </div>
      <SettingsCard
        title="All other settings"
        description="Every other key the machine reports, by its name in the backend."
      >
        {isLoading && <p className="px-5 py-4 text-sm text-ink-3">Loading…</p>}
        {entries.map(([key, value]) => {
          const label = humanize(key);
          const description = ADVANCED_NOTES[key] ?? key;
          if (typeof value === "boolean") {
            return (
              <ToggleSetting
                key={key}
                settingKey={key}
                label={label}
                description={description}
              />
            );
          }
          if (typeof value === "number") {
            return (
              <NumberSetting
                key={key}
                settingKey={key}
                label={label}
                description={description}
                step={0.01}
              />
            );
          }
          if (typeof value === "string" || value === null) {
            return (
              <TextSetting
                key={key}
                settingKey={key}
                label={label}
                description={description}
                nullable={value === null}
              />
            );
          }
          return (
            <SettingRow key={key} label={label} description={description}>
              <code className="block max-w-xs truncate font-mono text-xs text-ink-2">
                {JSON.stringify(value)}
              </code>
            </SettingRow>
          );
        })}
      </SettingsCard>
    </div>
  );
};

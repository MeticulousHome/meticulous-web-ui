import { useId } from "react";
import { useMachine } from "../../contexts/MachineProvider";
import { useDeviceInfo, useSettings } from "../../hooks/useMachineData";
import { useThemePreference, type ThemePreference } from "../../theme";
import { MachineAddressForm } from "../connection/MachineAddressForm";
import { Segmented } from "../ui/Segmented";
import { Switch } from "../ui/Switch";
import {
  NumberSetting,
  ReadOnlySetting,
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
      <SettingsCard
        title="Connection"
        description={
          <>
            This page talks to{" "}
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

export const BrewingSection = () => (
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
  </SettingsCard>
);

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
      <TextSetting
        settingKey="idle_screen"
        label="Idle screen"
        description="What the dial shows while idle."
      />
    </SettingsCard>
  </div>
);

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
      <ReadOnlySetting label="Timezone detection" value={data?.timezone_sync} />
      <ReadOnlySetting label="Timezone" value={data?.time_zone} />
      <ToggleSetting
        settingKey="ssh_enabled"
        label="SSH"
        description="Allow SSH logins to the machine."
      />
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
  "reverse_scrolling",
  "idle_screen",
  "debug_shot_data_retention_days",
  "update_channel",
  "timezone_sync",
  "time_zone",
  "ssh_enabled",
  "telemetry_service_enabled",
  "profile_order",
]);

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
    <SettingsCard
      title="All other settings"
      description="Every other key the machine reports, as it names them. Changes apply at once."
    >
      {isLoading && <p className="px-5 py-4 text-sm text-ink-3">Loading…</p>}
      {entries.map(([key, value]) => {
        const label = humanize(key);
        const description = (
          <span className="font-mono text-xs text-ink-3">{key}</span>
        );
        if (typeof value === "boolean") {
          return (
            <ToggleSetting
              key={key}
              settingKey={key}
              label={label}
              description={key}
            />
          );
        }
        if (typeof value === "number") {
          return (
            <NumberSetting
              key={key}
              settingKey={key}
              label={label}
              description={key}
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
              description={key}
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
  );
};

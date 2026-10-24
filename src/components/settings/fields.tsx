import { useEffect, useId, useState } from "react";
import { useSettings } from "../../hooks/useMachineData";
import { useToast } from "../ui/Toast";
import { Switch } from "../ui/Switch";
import { useSettingSaver } from "./useSettingSaver";

// One row of a settings card: label and description on the left, the control
// on the right (stacked on narrow screens).
export const SettingRow = ({
  label,
  description,
  htmlFor,
  children,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="block text-[15px] text-ink">
        {label}
      </label>
      {description && (
        <p className="mt-0.5 text-sm text-ink-2">{description}</p>
      )}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

export const SettingsCard = ({
  title,
  description,
  children,
  actions,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <section className="overflow-hidden rounded-2xl border border-line bg-surface">
    {(title || description || actions) && (
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          {title && <h3 className="text-base text-ink">{title}</h3>}
          {description && (
            <p className="mt-0.5 text-sm text-ink-2">{description}</p>
          )}
        </div>
        {actions}
      </header>
    )}
    <div className="divide-y divide-line">{children}</div>
  </section>
);

export const ToggleSetting = ({
  settingKey,
  label,
  description,
}: {
  settingKey: string;
  label: string;
  description?: string;
}) => {
  const { data } = useSettings();
  const save = useSettingSaver();
  const id = useId();
  const value = data?.[settingKey];
  return (
    <SettingRow label={label} description={description} htmlFor={id}>
      <Switch
        id={id}
        checked={value === true}
        disabled={typeof value !== "boolean"}
        onChange={(checked) => save({ [settingKey]: checked }, label)}
      />
    </SettingRow>
  );
};

const inputClass =
  "h-9 rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-3 focus:border-ink-2 focus:outline-none disabled:opacity-50";

// Text and number inputs save on blur or Enter, not on every keystroke.
const DraftInput = ({
  id,
  value,
  type,
  onCommit,
  suffix,
  width = "w-40",
  min,
  step,
}: {
  id: string;
  value: string;
  type: "text" | "number";
  onCommit: (value: string) => void;
  suffix?: string;
  width?: string;
  min?: number;
  step?: number;
}) => {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type={type}
        value={draft}
        min={min}
        step={step}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          if (event.key === "Escape") {
            setDraft(value);
            (event.target as HTMLInputElement).blur();
          }
        }}
        className={`${inputClass} ${width}`}
      />
      {suffix && <span className="text-sm text-ink-2">{suffix}</span>}
    </div>
  );
};

export const NumberSetting = ({
  settingKey,
  label,
  description,
  suffix,
  min,
  step,
}: {
  settingKey: string;
  label: string;
  description?: string;
  suffix?: string;
  min?: number;
  step?: number;
}) => {
  const { data } = useSettings();
  const save = useSettingSaver();
  const notify = useToast();
  const id = useId();
  const value = data?.[settingKey];
  return (
    <SettingRow label={label} description={description} htmlFor={id}>
      <DraftInput
        id={id}
        type="number"
        width="w-28"
        min={min}
        step={step}
        suffix={suffix}
        value={typeof value === "number" ? String(value) : ""}
        onCommit={(raw) => {
          const parsed = Number.parseFloat(raw);
          if (!Number.isFinite(parsed)) {
            notify(`${label} needs a number.`, "error");
            return;
          }
          save({ [settingKey]: parsed }, label);
        }}
      />
    </SettingRow>
  );
};

export const TextSetting = ({
  settingKey,
  label,
  description,
  nullable,
}: {
  settingKey: string;
  label: string;
  description?: string;
  // An empty field saves null instead of "".
  nullable?: boolean;
}) => {
  const { data } = useSettings();
  const save = useSettingSaver();
  const id = useId();
  const value = data?.[settingKey];
  return (
    <SettingRow label={label} description={description} htmlFor={id}>
      <DraftInput
        id={id}
        type="text"
        width="w-56"
        value={value === null || value === undefined ? "" : String(value)}
        onCommit={(raw) =>
          save(
            { [settingKey]: nullable && raw.trim() === "" ? null : raw },
            label,
          )
        }
      />
    </SettingRow>
  );
};

export const SelectSetting = ({
  settingKey,
  label,
  description,
  options,
  disabled,
}: {
  settingKey: string;
  label: string;
  description?: React.ReactNode;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) => {
  const { data } = useSettings();
  const save = useSettingSaver();
  const id = useId();
  const value = data?.[settingKey];
  const current = typeof value === "string" ? value : "";
  // Keep a value the list doesn't know selectable.
  const all =
    current && !options.some((option) => option.value === current)
      ? [...options, { value: current, label: current }]
      : options;
  return (
    <SettingRow label={label} description={description} htmlFor={id}>
      <select
        id={id}
        value={current}
        disabled={disabled || value === undefined}
        onChange={(event) => save({ [settingKey]: event.target.value }, label)}
        className={`${inputClass} w-56 pr-8`}
      >
        {all.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </SettingRow>
  );
};

// A value shown in a disabled field: visible, not editable from this page.
export const LockedSetting = ({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) => {
  const id = useId();
  return (
    <SettingRow label={label} description={description} htmlFor={id}>
      <input
        id={id}
        value={value}
        disabled
        readOnly
        className={`${inputClass} w-56 cursor-not-allowed`}
      />
    </SettingRow>
  );
};

export const ReadOnlySetting = ({
  label,
  value,
  description,
}: {
  label: string;
  value: React.ReactNode;
  description?: string;
}) => (
  <SettingRow label={label} description={description}>
    <span className="text-sm text-ink-2">{value ?? "–"}</span>
  </SettingRow>
);

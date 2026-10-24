interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

export const Switch = ({
  checked,
  onChange,
  disabled,
  label,
  id,
}: SwitchProps) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:opacity-50 ${
      checked ? "bg-accent" : "bg-line-strong"
    }`}
  >
    <span
      className={`size-5 rounded-full bg-surface shadow-sm transition-transform duration-200 ${
        checked ? "translate-x-4" : "translate-x-0"
      }`}
    />
  </button>
);

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}

export const Segmented = <T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: SegmentedProps<T>) => (
  <div
    role="radiogroup"
    aria-label={label}
    className="inline-flex rounded-lg bg-raised p-0.5"
  >
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(option.value)}
          className={`rounded-md transition-colors ${
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm"
          } ${
            active
              ? "bg-surface text-ink shadow-sm"
              : "text-ink-2 hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

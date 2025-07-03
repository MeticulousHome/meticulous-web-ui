import "./text.css";

interface TextInterface {
  label: string;
  size?: "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
  color?: string;
  className?: string;
}

export const Text = ({
  color,
  label,
  size = "base",
  className,
  ...props
}: TextInterface) => {
  const textClassName = [`${size ?? `m-text-${size}`}`, className].join(" ");

  return (
    <div className={textClassName} style={{ color }} {...props}>
      {label}
    </div>
  );
};

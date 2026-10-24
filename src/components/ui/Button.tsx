import { forwardRef } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-hover disabled:bg-raised disabled:text-ink-3",
  secondary:
    "bg-raised text-ink hover:bg-raised-hover disabled:text-ink-3 disabled:hover:bg-raised",
  outline:
    "border border-line-strong text-ink hover:bg-raised disabled:text-ink-3 disabled:hover:bg-transparent",
  ghost: "text-ink-2 hover:bg-raised hover:text-ink disabled:text-ink-3",
  danger:
    "bg-bad text-white hover:brightness-110 disabled:bg-raised disabled:text-ink-3",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-5 text-base gap-2.5 rounded-xl",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      loading = false,
      className = "",
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap font-normal transition-colors duration-150 select-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export const IconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(({ label, className = "", children, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-label={label}
    title={label}
    className={`inline-flex size-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-raised hover:text-ink disabled:text-ink-3 ${className}`}
    {...props}
  >
    {children}
  </button>
));
IconButton.displayName = "IconButton";

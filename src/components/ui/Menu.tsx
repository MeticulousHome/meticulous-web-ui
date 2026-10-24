import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}

interface MenuProps {
  label: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
  items: MenuItem[];
  align?: "left" | "right";
}

// Small dropdown menu: opens upward-right of its trigger, closes on outside
// click, Escape or a selection.
export const Menu = ({
  label,
  trigger,
  triggerClassName = "",
  items,
  align = "right",
}: MenuProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`${triggerClassName} ${open ? "opacity-100" : ""}`}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute bottom-full z-20 mb-1 min-w-48 rounded-xl border border-line bg-surface p-1 shadow-xl animate-rise-in ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-raised disabled:text-ink-3 disabled:hover:bg-transparent"
            >
              <span className="text-ink-2">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useMachine } from "../../contexts/MachineProvider";
import { useDeviceInfo } from "../../hooks/useMachineData";
import type { Tab } from "../../hooks/useRoute";
import { useThemePreference, type ThemePreference } from "../../theme";
import { IconButton } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { MachineAddressForm } from "../connection/MachineAddressForm";
import { CAN_CHANGE_MACHINE } from "../../api/api";
import { LogoMark } from "./LogoMark";

const TABS: { id: Tab; label: string }[] = [
  { id: "machine", label: "Machine" },
  { id: "sensors", label: "Sensors" },
  { id: "settings", label: "Settings" },
];

const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const THEME_ICON = {
  light: <Sun size={18} />,
  dark: <Moon size={18} />,
  system: <Monitor size={18} />,
};

const CONNECTION_LABEL = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Offline",
};

const CONNECTION_DOT = {
  connected: "bg-good",
  connecting: "bg-warn animate-pulse",
  disconnected: "bg-bad",
};

interface HeaderProps {
  tab: Tab;
  onNavigate: (tab: Tab) => void;
}

export const Header = ({ tab, onNavigate }: HeaderProps) => {
  const { connection, machineUrl } = useMachine();
  const { data: info } = useDeviceInfo();
  const [theme, setTheme] = useThemePreference();
  const [connectionOpen, setConnectionOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto grid max-w-[1400px] grid-cols-[1fr_auto] items-center gap-x-4 px-4 sm:px-8 md:grid-cols-[1fr_auto_1fr]">
        <button
          type="button"
          onClick={() => onNavigate("machine")}
          className="flex items-center gap-2.5 justify-self-start py-4 text-[22px] font-light tracking-[-0.01em] text-ink sm:text-2xl"
        >
          <LogoMark className="h-[17px] w-auto shrink-0 sm:h-[19px]" />
          Meticulous
        </button>

        <nav
          aria-label="Sections"
          className="order-last col-span-2 -mx-1 flex justify-center gap-1 md:order-none md:col-span-1 md:mx-0 md:gap-6"
        >
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
                className={`relative px-3 pt-1 pb-3 text-sm transition-colors md:py-5 ${
                  active ? "text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                {item.label}
                <span
                  className={`absolute inset-x-3 bottom-1.5 h-[1.5px] rounded-full bg-ink transition-opacity md:bottom-3.5 ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-1 sm:gap-2">
          <button
            type="button"
            // Only the dev server can switch machines; on the machine the pill
            // leads to its info in Settings.
            onClick={() =>
              CAN_CHANGE_MACHINE
                ? setConnectionOpen(true)
                : onNavigate("settings")
            }
            title={`${info?.name ?? "Machine"} · ${machineUrl.replace(/^https?:\/\//, "")}`}
            className="flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm text-ink-2 transition-colors hover:bg-raised hover:text-ink"
          >
            <span
              className={`size-2 shrink-0 rounded-full ${CONNECTION_DOT[connection]}`}
            />
            <span className="hidden max-w-[220px] truncate lg:inline">
              {connection === "connected" && info?.name
                ? info.name.replace(/^Meticulous/, "")
                : CONNECTION_LABEL[connection]}
            </span>
            <span className="lg:hidden">{CONNECTION_LABEL[connection]}</span>
          </button>
          <IconButton
            label={`Theme: ${theme}. Switch to ${NEXT_THEME[theme]}`}
            onClick={() => setTheme(NEXT_THEME[theme])}
          >
            {THEME_ICON[theme]}
          </IconButton>
        </div>
      </div>

      <Dialog
        open={CAN_CHANGE_MACHINE && connectionOpen}
        onClose={() => setConnectionOpen(false)}
        title="Machine"
        description={
          connection === "connected" && info
            ? `${info.name} · serial ${info.serial}`
            : "Choose the machine this page talks to."
        }
      >
        <MachineAddressForm onDone={() => setConnectionOpen(false)} />
      </Dialog>
    </header>
  );
};

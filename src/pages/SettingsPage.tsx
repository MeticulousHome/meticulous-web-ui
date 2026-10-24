import {
  Coffee,
  Cpu,
  Disc3,
  FileDown,
  ListOrdered,
  Server,
  SlidersHorizontal,
  Terminal,
} from "lucide-react";
import { useSettings } from "../hooks/useMachineData";
import {
  AdvancedSection,
  BrewingSection,
  DialSection,
  MachineSection,
  SystemSection,
} from "../components/settings/sections";
import { ProfileOrderSection } from "../components/settings/ProfileOrderSection";
import { DiagnosticsSection } from "../components/settings/DiagnosticsSection";
import { ApiExplorer } from "../components/api/ApiExplorer";
import { Spinner } from "../components/ui/Spinner";

const SECTIONS = [
  { id: "machine", label: "Machine", icon: Server, needsSettings: false },
  { id: "brewing", label: "Brewing", icon: Coffee, needsSettings: true },
  { id: "dial", label: "Dial", icon: Disc3, needsSettings: true },
  { id: "system", label: "System", icon: Cpu, needsSettings: true },
  {
    id: "profiles",
    label: "Profile order",
    icon: ListOrdered,
    needsSettings: true,
  },
  {
    id: "diagnostics",
    label: "Logs & archive",
    icon: FileDown,
    needsSettings: false,
  },
  {
    id: "advanced",
    label: "Advanced",
    icon: SlidersHorizontal,
    needsSettings: true,
  },
  { id: "api", label: "API", icon: Terminal, needsSettings: false },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const CONTENT: Record<SectionId, React.ReactNode> = {
  machine: <MachineSection />,
  brewing: <BrewingSection />,
  dial: <DialSection />,
  system: <SystemSection />,
  profiles: <ProfileOrderSection />,
  diagnostics: <DiagnosticsSection />,
  advanced: <AdvancedSection />,
  api: <ApiExplorer />,
};

const DESCRIPTIONS: Partial<Record<SectionId, string>> = {
  api: "Run any backend endpoint against this machine, with its parameters.",
};

interface SettingsPageProps {
  section?: string;
  onSection: (id: SectionId) => void;
}

const SettingsPage = ({ section, onSection }: SettingsPageProps) => {
  const active = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];
  const settings = useSettings();
  const wide = active.id === "api";

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-8 lg:flex-row lg:gap-10 lg:pt-8">
      <aside className="lg:w-56 lg:shrink-0">
        <h1 className="mb-4 hidden text-2xl text-ink lg:block">Settings</h1>
        <nav
          aria-label="Settings sections"
          className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:px-0"
        >
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const current = item.id === active.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={current ? "page" : undefined}
                onClick={() => onSection(item.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors ${
                  current
                    ? "bg-raised text-ink"
                    : "text-ink-2 hover:bg-raised/60 hover:text-ink"
                }`}
              >
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className={current ? "text-ink" : "text-ink-3"}
                />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className={`min-w-0 flex-1 ${wide ? "" : "lg:max-w-3xl"}`}>
        <div className="mb-5">
          <h2 className="text-xl text-ink">{active.label}</h2>
          {DESCRIPTIONS[active.id] && (
            <p className="mt-1 text-sm text-ink-2">{DESCRIPTIONS[active.id]}</p>
          )}
        </div>
        {active.needsSettings && settings.isLoading ? (
          <div className="flex justify-center py-16 text-ink-3">
            <Spinner className="size-6" />
          </div>
        ) : active.needsSettings && settings.error ? (
          <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-2">
            Couldn’t read the settings: {settings.error.message}
          </p>
        ) : (
          CONTENT[active.id]
        )}
      </div>
    </div>
  );
};

export default SettingsPage;

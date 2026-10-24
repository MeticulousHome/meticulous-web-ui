import { useEffect, useState } from "react";
import { ArrowUpToLine, Check, Droplets, Heater, Scale } from "lucide-react";
import {
  useStatusField,
  useMachine,
  usePreheatRemaining,
} from "../../contexts/MachineProvider";
import {
  useMachineAction,
  type MachineAction,
} from "../../hooks/useMachineData";
import { useToast } from "../ui/Toast";
import { Spinner } from "../ui/Spinner";

interface ActionDef {
  action: MachineAction;
  label: string;
  icon: React.ReactNode;
  hint: string;
}

const ACTIONS: ActionDef[] = [
  {
    action: "tare",
    label: "Tare",
    icon: <Scale size={26} strokeWidth={1.5} />,
    hint: "Zero the scale",
  },
  {
    action: "purge",
    label: "Purge",
    icon: <Droplets size={26} strokeWidth={1.5} />,
    hint: "Flush water through the group",
  },
  {
    action: "home",
    label: "Raise",
    icon: <ArrowUpToLine size={26} strokeWidth={1.5} />,
    hint: "Move the piston up to its home position",
  },
  {
    action: "preheat",
    label: "Preheat",
    icon: <Heater size={26} strokeWidth={1.5} />,
    hint: "Heat the group to the profile temperature",
  },
];

export const ActionGrid = () => {
  const state = useStatusField((status) => status?.state);
  const { connection } = useMachine();
  const mutation = useMachineAction();
  const notify = useToast();
  const [pending, setPending] = useState<MachineAction | null>(null);
  const [done, setDone] = useState<MachineAction | null>(null);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(null), 1400);
    return () => clearTimeout(timer);
  }, [done]);

  const idle = state === "idle";
  const online = connection === "connected";
  const preheatRemaining = usePreheatRemaining();
  const preheating = preheatRemaining > 0;

  const run = (action: ActionDef) => {
    setPending(action.action);
    mutation.mutate(action.action, {
      onSuccess: () => setDone(action.action),
      onError: (error) => notify(`${action.label}: ${error.message}`, "error"),
      onSettled: () => setPending(null),
    });
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
      {ACTIONS.map((item) => {
        // Preheat is a toggle: the same action turns it off again.
        const active = item.action === "preheat" && preheating;
        // Tare works any time; the rest need an idle machine.
        const enabled = online && (item.action === "tare" || idle || active);
        const busy = pending === item.action;
        const ok = done === item.action && !active;
        return (
          <button
            key={item.action}
            type="button"
            title={active ? "Preheating. Click to stop." : item.hint}
            aria-pressed={item.action === "preheat" ? active : undefined}
            disabled={!enabled || busy}
            onClick={() => run(item)}
            className={`group flex h-[88px] flex-col items-center justify-center gap-2 rounded-xl border transition-all duration-150 active:scale-[0.985] disabled:border-line disabled:bg-transparent disabled:text-ink-3 disabled:active:scale-100 sm:h-[100px] ${
              active
                ? "border-ink bg-surface text-ink"
                : "border-transparent bg-raised text-ink hover:bg-raised-hover"
            }`}
          >
            <span className="flex h-7 items-center justify-center">
              {busy ? (
                <Spinner className="size-5" />
              ) : ok ? (
                <Check size={26} strokeWidth={1.5} className="text-good" />
              ) : (
                item.icon
              )}
            </span>
            <span className="text-[17px] leading-none">
              {active ? (
                <>
                  Preheating{" "}
                  <span className="text-ink-2">
                    {Math.floor(preheatRemaining / 60)}:
                    {String(Math.floor(preheatRemaining % 60)).padStart(2, "0")}
                  </span>
                </>
              ) : (
                item.label
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};

import { ChevronRight, Play, Square, X } from "lucide-react";
import { useMachine, useStatusField } from "../../contexts/MachineProvider";
import {
  useLoadProfile,
  useMachineAction,
  type MachineAction,
} from "../../hooks/useMachineData";
import { ProfileArt } from "../profiles/ProfileCard";
import { useOrderedProfiles } from "../profiles/useOrderedProfiles";
import { useProfileSelection } from "../profiles/ProfileSelection";
import { useToast } from "../ui/Toast";
import { Spinner } from "../ui/Spinner";

// Stages where the profile waits for a click ("click to start",
// "Pour water and click to continue", "Click to purge").
const isWaitingForClick = (name?: string) => !!name && /click to/i.test(name);

const bigButton =
  "flex h-[74px] items-center justify-center gap-3 rounded-xl text-xl transition-all duration-150 active:scale-[0.99] disabled:bg-raised disabled:text-ink-3 disabled:active:scale-100";

export const ShotControls = ({
  onPickProfile,
}: {
  onPickProfile: () => void;
}) => {
  const state = useStatusField((status) => status?.state);
  const stage = useStatusField((status) => status?.name);
  const extracting = useStatusField((status) => !!status?.extracting);
  const { connection } = useMachine();
  const { selected, loaded, selectedName } = useOrderedProfiles();
  const { choose } = useProfileSelection();
  const action = useMachineAction();
  const loadProfile = useLoadProfile();
  const notify = useToast();

  const online = connection === "connected";
  const idle = state === "idle";
  const waiting = !idle && isWaitingForClick(stage);
  const pending = loadProfile.isPending
    ? "start"
    : action.isPending
      ? action.variables
      : undefined;

  const run = (name: MachineAction, verb: string) =>
    action.mutate(name, {
      onError: (error) => notify(`Couldn't ${verb}: ${error.message}`, "error"),
    });

  // Loading sends the selected profile to the machine, which starts it: it
  // heats and, unless auto start is on, waits at "click to start".
  const startShot = () => {
    if (!selected) {
      run("start", "start the shot");
      return;
    }
    loadProfile.mutate(selected.id, {
      onSuccess: () => choose(null),
      onError: (error) =>
        notify(`Couldn't start ${selected.name}: ${error.message}`, "error"),
    });
  };

  let primary: React.ReactNode;
  if (!online || idle || !state) {
    primary = (
      <button
        type="button"
        onClick={startShot}
        disabled={!online || !state || !!pending}
        className={`${bigButton} bg-accent text-on-accent hover:bg-accent-hover`}
      >
        {pending === "start" ? (
          <Spinner className="size-5" />
        ) : (
          <Play size={20} fill="currentColor" strokeWidth={0} />
        )}
        Start shot
      </button>
    );
  } else if (waiting) {
    // The profile is heated and waits for the go-ahead, like the dial's click.
    primary = (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => run("continue", "continue")}
          disabled={!!pending}
          className={`${bigButton} flex-1 bg-accent text-on-accent hover:bg-accent-hover`}
          title={stage}
        >
          {pending === "continue" ? (
            <Spinner className="size-5" />
          ) : (
            <Play size={20} fill="currentColor" strokeWidth={0} />
          )}
          {/start/i.test(stage ?? "") ? "Start" : "Continue"}
        </button>
        <button
          type="button"
          onClick={() => run("abort", "cancel")}
          disabled={!!pending}
          aria-label="Cancel"
          title="Cancel"
          className={`${bigButton} w-[74px] border border-line-strong text-ink hover:bg-raised`}
        >
          {pending === "abort" ? (
            <Spinner className="size-5" />
          ) : (
            <X size={22} />
          )}
        </button>
      </div>
    );
  } else {
    // Brewing, heating, purging or homing: one button that ends it.
    primary = (
      <button
        type="button"
        onClick={() => run("abort", "stop")}
        disabled={!!pending}
        className={`${bigButton} bg-bad text-white hover:brightness-110`}
      >
        {pending === "abort" ? (
          <Spinner className="size-5" />
        ) : (
          <Square size={18} fill="currentColor" strokeWidth={0} />
        )}
        {extracting ? "Stop shot" : "Cancel"}
      </button>
    );
  }

  return (
    // minmax(0, 1fr): a long name truncates instead of widening its column.
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <button
        type="button"
        onClick={onPickProfile}
        className="flex h-[74px] min-w-0 items-center gap-3 rounded-xl border border-line bg-surface pr-4 pl-3 text-left transition-colors hover:border-line-strong"
      >
        <span className="size-[50px] shrink-0 overflow-hidden rounded-lg bg-raised">
          {/* Keyed so a failed image doesn't carry over to the next profile. */}
          {selected && <ProfileArt key={selected.id} profile={selected} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-ink-2">
            {selected && loaded && selected.id !== loaded.id
              ? "Not loaded yet"
              : "Selected profile"}
          </span>
          <span className="mt-1 block truncate text-xl leading-tight text-ink">
            {selectedName ?? "None"}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink-3" />
      </button>
      {primary}
    </div>
  );
};

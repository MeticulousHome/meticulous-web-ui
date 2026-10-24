import { useLayoutEffect, useRef } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { useMachine } from "../../contexts/MachineProvider";
import { useDragScroll } from "../../hooks/useDragScroll";
import { ProfileCard } from "./ProfileCard";
import { ProfileImportButton } from "./ProfileImportButton";
import { useOrderedProfiles } from "./useOrderedProfiles";
import { useProfileSelection } from "./ProfileSelection";

const CARD_WIDTH = "w-[184px] sm:w-[200px]";
const ITEM_SELECTOR = "[data-strip-item]";

// Where the strip was scrolled, kept while the Machine tab is unmounted so
// switching tabs brings it back as it was (a reload starts over).
const memory: {
  machineUrl?: string;
  left?: number;
  loadedId?: string;
} = {};

export const ProfileStrip = ({ onViewAll }: { onViewAll: () => void }) => {
  const { machineUrl } = useMachine();
  const { profiles, selected, loaded, isLoading, error } = useOrderedProfiles();
  const { choose } = useProfileSelection();
  const stripRef = useRef<HTMLDivElement>(null);
  const hasProfiles = profiles.length > 0;
  const loadedId = loaded?.id;
  useDragScroll(stripRef, ITEM_SELECTOR, !error);

  // Save the position as the tab unmounts. A layout cleanup still runs with
  // the strip attached, so scrollLeft is real (a passive cleanup reads 0).
  useLayoutEffect(() => {
    const strip = stripRef.current;
    return () => {
      if (strip && memory.machineUrl === machineUrl) {
        memory.left = strip.scrollLeft;
      }
    };
  }, [machineUrl]);

  // Before paint: put the strip back where it was. Bring the loaded profile
  // to the front only the first time, or when the machine loads another one
  // (never on a click here, which would move the card away from the pointer).
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip || !hasProfiles) return;
    const sameMachine = memory.machineUrl === machineUrl;
    memory.machineUrl = machineUrl;
    if (loadedId && (!sameMachine || memory.loadedId !== loadedId)) {
      memory.loadedId = loadedId;
      const card = strip.querySelector<HTMLElement>(
        `[data-profile-id="${CSS.escape(loadedId)}"]`,
      );
      if (!card) return;
      const padding = Number.parseFloat(getComputedStyle(strip).paddingLeft);
      strip.scrollTo({ left: card.offsetLeft - padding, behavior: "smooth" });
    } else if (sameMachine && memory.left !== undefined) {
      strip.scrollLeft = memory.left;
    }
  }, [loadedId, hasProfiles, machineUrl]);

  return (
    <section aria-labelledby="profiles-heading">
      <div className="mb-3 flex items-end justify-between">
        <h2 id="profiles-heading" className="text-xl text-ink">
          Profiles
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink-2 hover:text-ink"
        >
          View all
          {profiles.length > 0 && (
            <span className="text-ink-3">{profiles.length}</span>
          )}
          <ChevronRight size={16} />
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-sm text-ink-2">
          Couldn’t read the profiles: {error.message}
        </p>
      ) : (
        <div
          ref={stripRef}
          className="no-scrollbar relative -mx-4 flex cursor-grab snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-3 select-none data-[dragging=true]:cursor-grabbing sm:-mx-8 sm:scroll-px-8 sm:px-8 [&[data-dragging=true]_*]:cursor-grabbing"
        >
          {isLoading
            ? Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className={`${CARD_WIDTH} shrink-0 animate-pulse rounded-xl bg-surface p-2 ring-1 ring-line`}
                >
                  <div className="aspect-[16/10] rounded-lg bg-raised" />
                  <div className="mx-1.5 my-4 h-3 w-24 rounded bg-raised" />
                </div>
              ))
            : profiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  selected={profile.id === selected?.id}
                  loaded={profile.id === loaded?.id}
                  onSelect={(choice) => choose(choice.id)}
                  className={`${CARD_WIDTH} shrink-0 snap-start`}
                />
              ))}
          <ProfileImportButton
            className={`${CARD_WIDTH} flex min-h-[176px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-ink-2 transition-colors hover:bg-surface hover:text-ink`}
            label="Add a profile from a JSON file"
            data-strip-item
          >
            <Plus size={22} strokeWidth={1.5} />
            <span className="text-[15px]">New profile</span>
            <span className="text-xs text-ink-3">Import JSON</span>
          </ProfileImportButton>
        </div>
      )}
    </section>
  );
};

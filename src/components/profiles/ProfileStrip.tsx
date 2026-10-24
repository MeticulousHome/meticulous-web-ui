import { useEffect, useRef } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { ProfileCard } from "./ProfileCard";
import { ProfileImportButton } from "./ProfileImportButton";
import { useOrderedProfiles } from "./useOrderedProfiles";
import { useProfileActions } from "./useProfileActions";

const CARD_WIDTH = "w-[184px] sm:w-[200px]";

export const ProfileStrip = ({ onViewAll }: { onViewAll: () => void }) => {
  const { profiles, selected, isLoading, error } = useOrderedProfiles();
  const { load, canLoad } = useProfileActions();
  const stripRef = useRef<HTMLDivElement>(null);
  const hasProfiles = profiles.length > 0;

  // Bring the loaded profile to the front of the strip when it changes.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !selected || !hasProfiles) return;
    const card = strip.querySelector<HTMLElement>(
      `[data-profile-id="${CSS.escape(selected.id)}"]`,
    );
    if (!card) return;
    const padding = Number.parseFloat(getComputedStyle(strip).paddingLeft);
    strip.scrollTo({ left: card.offsetLeft - padding, behavior: "smooth" });
  }, [selected, hasProfiles]);

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
          className="no-scrollbar relative -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-3 sm:-mx-8 sm:scroll-px-8 sm:px-8"
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
                  disabled={!canLoad}
                  onLoad={load}
                  className={`${CARD_WIDTH} shrink-0 snap-start`}
                />
              ))}
          <ProfileImportButton
            className={`${CARD_WIDTH} flex min-h-[176px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-ink-2 transition-colors hover:bg-surface hover:text-ink`}
            label="Add a profile from a JSON file"
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

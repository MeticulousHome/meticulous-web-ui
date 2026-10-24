import { useMemo, useState } from "react";
import { Search, Upload } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Spinner } from "../ui/Spinner";
import { ProfileCard } from "./ProfileCard";
import { ProfileImportButton } from "./ProfileImportButton";
import { useOrderedProfiles } from "./useOrderedProfiles";
import { useProfileSelection } from "./ProfileSelection";

export const ProfilePicker = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { profiles, selected, loaded, isLoading, error } = useOrderedProfiles();
  const { choose } = useProfileSelection();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return profiles;
    return profiles.filter(
      (profile) =>
        profile.name.toLowerCase().includes(needle) ||
        profile.author?.toLowerCase().includes(needle),
    );
  }, [profiles, query]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title="Profiles"
      description={`${profiles.length} on this machine. Pick one, then run it with Start shot.`}
      footer={
        <ProfileImportButton className="inline-flex h-10 items-center gap-2 rounded-lg bg-raised px-4 text-sm text-ink hover:bg-raised-hover">
          <Upload size={16} />
          Import JSON
        </ProfileImportButton>
      }
    >
      <div className="sticky top-0 z-10 -mx-6 mb-4 bg-surface px-6 pb-2">
        <label className="flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-canvas px-3 focus-within:border-ink-2">
          <Search size={16} className="text-ink-3" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or author"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
          />
        </label>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12 text-ink-3">
          <Spinner className="size-6" />
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-bad">{error.message}</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-3">
          No profile matches “{query}”.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              selected={profile.id === selected?.id}
              loaded={profile.id === loaded?.id}
              onSelect={(choice) => {
                choose(choice.id);
                onClose();
              }}
            />
          ))}
        </div>
      )}
    </Dialog>
  );
};

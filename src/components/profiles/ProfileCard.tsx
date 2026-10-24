import { useState } from "react";
import type { Profile } from "@meticulous-home/espresso-profile";
import { Download, Ellipsis } from "lucide-react";
import { profileImageUrl } from "../../api/api";
import { useMachine } from "../../contexts/MachineProvider";
import { saveJson } from "../../lib/download";
import { Menu } from "../ui/Menu";

interface ProfileCardProps {
  profile: Profile;
  // Picked on this page (or loaded, when nothing is picked).
  selected?: boolean;
  // Loaded on the machine right now.
  loaded?: boolean;
  onSelect: (profile: Profile) => void;
  className?: string;
}

const downloadProfile = (profile: Profile) =>
  saveJson(
    profile,
    `${profile.name.replace(/[^\w\- ]+/g, "").trim() || "profile"}.json`,
  );

// Artwork, or a soft gradient in the profile's accent color when it has none
// (or the image fails to load).
const ProfileArt = ({ profile }: { profile: Profile }) => {
  const { machineUrl } = useMachine();
  const [failed, setFailed] = useState(false);
  const src = profileImageUrl(machineUrl, profile.display?.image);
  const accent = profile.display?.accentColor ?? "#8f8f8a";
  if (!src || failed) {
    return (
      <div
        className="size-full"
        style={{
          background: `radial-gradient(120% 120% at 20% 10%, ${accent}cc 0%, ${accent}55 45%, transparent 100%), linear-gradient(135deg, ${accent}33, ${accent}88)`,
        }}
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
    />
  );
};

export const ProfileCard = ({
  profile,
  selected,
  loaded,
  onSelect,
  className = "",
}: ProfileCardProps) => (
  <div
    data-profile-id={profile.id}
    data-strip-item
    className={`group relative flex flex-col rounded-xl bg-surface p-2 transition-shadow ${
      selected
        ? "ring-[1.5px] ring-ink"
        : "ring-1 ring-line hover:ring-line-strong"
    } ${className}`}
  >
    <button
      type="button"
      onClick={() => onSelect(profile)}
      aria-pressed={!!selected}
      aria-label={`${profile.name}${loaded ? " (on the machine)" : ""}`}
      className="flex flex-col text-left"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-raised">
        <ProfileArt profile={profile} />
        {loaded && !selected && (
          <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] text-ink-2 backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-good" />
            On machine
          </span>
        )}
      </div>
      <div className="flex min-h-11 items-center pr-7 pl-1.5">
        <span className="truncate text-[15px] text-ink">{profile.name}</span>
      </div>
    </button>
    <div className="absolute right-2 bottom-2">
      <Menu
        label={`${profile.name} options`}
        trigger={<Ellipsis size={16} />}
        triggerClassName={`flex size-7 items-center justify-center rounded-md text-ink-2 transition-opacity hover:bg-raised hover:text-ink ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        }`}
        items={[
          {
            label: "Download JSON",
            icon: <Download size={14} />,
            onSelect: () => downloadProfile(profile),
          },
        ]}
      />
    </div>
  </div>
);

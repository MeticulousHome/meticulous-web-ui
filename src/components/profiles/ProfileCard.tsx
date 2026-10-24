import { useState } from "react";
import type { Profile } from "@meticulous-home/espresso-profile";
import { Download, Ellipsis, Play } from "lucide-react";
import { profileImageUrl } from "../../api/api";
import { useMachine } from "../../contexts/MachineProvider";
import { saveJson } from "../../lib/download";
import { Menu } from "../ui/Menu";

interface ProfileCardProps {
  profile: Profile;
  selected?: boolean;
  disabled?: boolean;
  onLoad: (profile: Profile) => void;
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
  disabled,
  onLoad,
  className = "",
}: ProfileCardProps) => (
  <div
    data-profile-id={profile.id}
    className={`group relative flex flex-col rounded-xl bg-surface p-2 transition-shadow ${
      selected
        ? "ring-[1.5px] ring-ink"
        : "ring-1 ring-line hover:ring-line-strong"
    } ${className}`}
  >
    <button
      type="button"
      disabled={disabled}
      onClick={() => onLoad(profile)}
      aria-label={
        selected ? `${profile.name} (loaded)` : `Load ${profile.name}`
      }
      className="flex flex-col text-left disabled:cursor-default"
    >
      <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-raised">
        <ProfileArt profile={profile} />
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
            label: selected ? "Loaded on the machine" : "Load on the machine",
            icon: <Play size={14} />,
            disabled: selected || disabled,
            onSelect: () => onLoad(profile),
          },
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

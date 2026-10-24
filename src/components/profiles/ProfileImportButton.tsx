import { useRef } from "react";
import type { Profile } from "@meticulous-home/espresso-profile";
import { useSaveProfile } from "../../hooks/useMachineData";
import { useToast } from "../ui/Toast";

// A hidden file input behind any trigger element: saves the profile in the
// chosen .json file to the machine.
export const ProfileImportButton = ({
  children,
  className,
  label = "Import a profile from a JSON file",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
} & React.HTMLAttributes<HTMLButtonElement>) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const save = useSaveProfile();
  const notify = useToast();

  const importFile = async (file: File) => {
    let profile: Profile;
    try {
      profile = JSON.parse(await file.text()) as Profile;
      if (!profile || typeof profile !== "object" || !profile.name) {
        throw new Error("missing name");
      }
    } catch {
      notify(`${file.name} isn't a profile JSON file.`, "error");
      return;
    }
    save.mutate(profile, {
      onSuccess: () =>
        notify(`${profile.name} saved to the machine`, "success"),
      onError: (error) =>
        notify(`Couldn't save ${profile.name}: ${error.message}`, "error"),
    });
  };

  return (
    <>
      <button
        type="button"
        title={label}
        disabled={save.isPending}
        onClick={() => inputRef.current?.click()}
        className={className}
        {...props}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importFile(file);
          event.target.value = "";
        }}
      />
    </>
  );
};

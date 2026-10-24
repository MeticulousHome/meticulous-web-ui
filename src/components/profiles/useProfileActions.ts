import { useCallback } from "react";
import type { Profile } from "@meticulous-home/espresso-profile";
import { useMachine, useStatusField } from "../../contexts/MachineProvider";
import { useLoadProfile, useSaveProfile } from "../../hooks/useMachineData";
import { useToast } from "../ui/Toast";

export const useProfileActions = () => {
  const state = useStatusField((status) => status?.state);
  const { connection } = useMachine();
  const loadMutation = useLoadProfile();
  const saveMutation = useSaveProfile();
  const notify = useToast();

  // Loading a profile while brewing or purging would interrupt the machine.
  const canLoad = connection === "connected" && state === "idle";

  const load = useCallback(
    (profile: Profile) => {
      if (!canLoad) {
        notify("Profiles can be loaded while the machine is idle.");
        return;
      }
      loadMutation.mutate(profile.id, {
        onSuccess: () => notify(`${profile.name} loaded`, "success"),
        onError: (error) =>
          notify(`Couldn't load ${profile.name}: ${error.message}`, "error"),
      });
    },
    [canLoad, loadMutation, notify],
  );

  // Saves a profile from a .json file to the machine.
  const importFile = useCallback(
    async (file: File) => {
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
      saveMutation.mutate(profile, {
        onSuccess: () =>
          notify(`${profile.name} saved to the machine`, "success"),
        onError: (error) =>
          notify(`Couldn't save ${profile.name}: ${error.message}`, "error"),
      });
    },
    [saveMutation, notify],
  );

  return {
    load,
    canLoad,
    loadingId: loadMutation.isPending ? loadMutation.variables : undefined,
    importFile,
    importing: saveMutation.isPending,
  };
};

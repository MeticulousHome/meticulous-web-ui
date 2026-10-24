import { useMemo } from "react";
import type { Profile } from "@meticulous-home/espresso-profile";
import { useProfiles, useSettings } from "../../hooks/useMachineData";
import { useStatusField } from "../../contexts/MachineProvider";
import { useProfileSelection } from "./ProfileSelection";

// Profiles in the order set on the machine (settings.profile_order), then any
// the order doesn't list; the one loaded on the machine; and the selected one
// (picked on this page, or else the loaded one).
export const useOrderedProfiles = () => {
  const profiles = useProfiles();
  const { data: settings } = useSettings();
  const { chosenId } = useProfileSelection();
  const order = settings?.profile_order;
  const loadedId = useStatusField((status) => status?.id);
  const loadedName = useStatusField((status) => status?.loaded_profile);

  const ordered = useMemo(() => {
    const list = profiles.data ?? [];
    if (!order?.length) return list;
    const rank = new Map(order.map((id, index) => [id, index]));
    return [...list].sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [profiles.data, order]);

  const loaded: Profile | undefined = useMemo(
    () =>
      ordered.find((profile) => profile.id === loadedId) ??
      ordered.find((profile) => profile.name === loadedName),
    [ordered, loadedId, loadedName],
  );

  const chosen = useMemo(
    () =>
      chosenId ? ordered.find((profile) => profile.id === chosenId) : undefined,
    [ordered, chosenId],
  );

  const selected = chosen ?? loaded;

  return {
    profiles: ordered,
    loaded,
    selected,
    selectedName: selected?.name ?? loadedName,
    isLoading: profiles.isLoading,
    error: profiles.error,
  };
};

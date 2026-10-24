import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useMachine } from "../../contexts/MachineProvider";

interface ProfileSelection {
  // The profile picked on this page, not yet sent to the machine. null
  // follows the profile loaded on the machine.
  chosenId: string | null;
  choose: (id: string | null) => void;
}

const ProfileSelectionContext = createContext<ProfileSelection>({
  chosenId: null,
  choose: () => {},
});

// Picking a profile only selects it here; Start shot is what loads it on the
// machine (loading sends it to the machine, which starts heating). Lives
// above the tabs so the choice survives switching tabs.
export const ProfileSelectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { machineUrl } = useMachine();
  const [chosenId, choose] = useState<string | null>(null);

  // Another machine has other profiles.
  useEffect(() => {
    choose(null);
  }, [machineUrl]);

  const value = useMemo(() => ({ chosenId, choose }), [chosenId]);
  return (
    <ProfileSelectionContext.Provider value={value}>
      {children}
    </ProfileSelectionContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useProfileSelection = () => useContext(ProfileSelectionContext);

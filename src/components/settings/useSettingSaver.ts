import {
  useUpdateSettings,
  type MachineSettings,
} from "../../hooks/useMachineData";
import { useToast } from "../ui/Toast";

// Saves one setting (or a nested object) at once, with a toast on failure.
export const useSettingSaver = () => {
  const mutation = useUpdateSettings();
  const notify = useToast();
  return (update: Partial<MachineSettings>, label: string) =>
    mutation.mutate(update, {
      onError: (error) =>
        notify(
          `Couldn't save ${label.toLowerCase()}: ${error.message}`,
          "error",
        ),
    });
};

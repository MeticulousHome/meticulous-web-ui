import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosResponse } from "axios";
import type {
  ActionType,
  APIError,
  DeviceInfo,
  HistoryEntry,
  Settings,
} from "@meticulous-home/espresso-api";
import type { Profile } from "@meticulous-home/espresso-profile";
import { useMachine } from "../contexts/MachineProvider";
import { errorMessage } from "../api/api";

// The backend answers some failures with 200 and { error, description }.
const unwrap = async <T>(
  request: Promise<AxiosResponse<T | APIError>>,
): Promise<T> => {
  try {
    const { data } = await request;
    if (data && typeof data === "object" && "error" in data) {
      const apiError = data as APIError;
      throw new Error(apiError.description || apiError.error);
    }
    return data as T;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
};

// The settings object carries more keys than the published type.
export type MachineSettings = Settings & {
  profile_order?: string[];
  [key: string]: unknown;
};

export type MachineInfo = DeviceInfo & { [key: string]: unknown };

// Machine actions accepted by /api/v1/action/{action}. "abort" ends a profile
// the way the dial does (retracts once past heating); "stop" cuts heater and
// motor at once; "preheat" toggles preheating.
export type MachineAction = ActionType | "purge" | "home" | "abort" | "finish";

export const useDeviceInfo = () => {
  const { api, machineUrl } = useMachine();
  return useQuery({
    queryKey: [machineUrl, "device-info"],
    queryFn: async () =>
      (await unwrap<DeviceInfo>(api.getDeviceInfo())) as MachineInfo,
    staleTime: 60_000,
    retry: 1,
  });
};

export const useProfiles = () => {
  const { api, machineUrl } = useMachine();
  return useQuery({
    queryKey: [machineUrl, "profiles"],
    queryFn: () => unwrap<Profile[]>(api.fetchAllProfiles()),
    staleTime: 30_000,
  });
};

export const useSettings = () => {
  const { api, machineUrl } = useMachine();
  return useQuery({
    queryKey: [machineUrl, "settings"],
    queryFn: () => unwrap<MachineSettings>(api.getSettings()),
    refetchInterval: 10_000,
  });
};

export const useUpdateSettings = () => {
  const { api, machineUrl } = useMachine();
  const queryClient = useQueryClient();
  const queryKey = [machineUrl, "settings"];
  return useMutation({
    mutationFn: (update: Partial<MachineSettings>) =>
      unwrap<MachineSettings>(api.updateSetting(update as Partial<Settings>)),
    // Optimistic: the switch moves at once and rolls back on failure.
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MachineSettings>(queryKey);
      if (previous) {
        queryClient.setQueryData(queryKey, { ...previous, ...update });
      }
      return { previous };
    },
    onError: (_error, _update, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
};

export const useLastShot = () => {
  const { api, machineUrl } = useMachine();
  return useQuery({
    queryKey: [machineUrl, "last-shot"],
    queryFn: () => unwrap<HistoryEntry | null>(api.getLastShot()),
    refetchInterval: 15_000,
  });
};

export const useMachineAction = () => {
  const { api } = useMachine();
  return useMutation({
    mutationFn: (action: MachineAction) =>
      unwrap(api.executeAction(action as ActionType)),
  });
};

export const useLoadProfile = () => {
  const { api } = useMachine();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.loadProfileByID(id)),
  });
};

export const useSaveProfile = () => {
  const { api, machineUrl } = useMachine();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: Profile) => unwrap(api.saveProfile(profile)),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [machineUrl, "profiles"] }),
  });
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/api";
import type { APIError, Settings } from "@meticulous-home/espresso-api";

async function getSettings(): Promise<Settings> {
  try {
    const response = await api.getSettings();
    const data = response.data;
    if (data && "error" in data) {
      throw new Error((data as APIError).error);
    }
    return data as Settings;
  } catch (error) {
    if (typeof error === "object" && error !== null && "response" in error) {
      const err = error as { response: { data?: any } };
      console.error("Error getting Settings: ", err.response.data);
      throw new Error(err.response.data?.message || "Error getting Settings.");
    } else {
      const err = error as { message?: string };
      console.error("Network error while getting Settings: ", err.message);
      throw new Error("Network error while getting Settings.");
    }
  }
}

async function updateSettings(update: Partial<Settings>): Promise<Settings> {
  try {
    const response = await api.updateSetting(update);
    const data = response.data;
    if (data && "error" in data) {
      throw new Error((data as APIError).error);
    }
    return data as Settings;
  } catch (error) {
    if (typeof error === "object" && error !== null && "response" in error) {
      const err = error as { response: { data?: any } };
      console.error("Error updating settings: ", err.response.data);
      throw new Error(err.response.data?.message || "Error updating settings.");
    } else {
      const err = error as { message?: string };
      console.error("Network error while updating settings:", err.message);
      throw new Error("Network error while updating settings.");
    }
  }
}

export const useSettings = () => {
  return useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    refetchInterval: 2000,
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
};

import { useQuery } from "@tanstack/react-query";
import { api } from "../api/api";
import type { APIError } from "@meticulous-home/espresso-api";
import type { Profile } from "@meticulous-home/espresso-profile";

async function getProfiles(): Promise<Profile[]> {
  try {
    const response = await api.fetchAllProfiles();
    const data = response.data;
    if ("error" in data) {
      throw new Error((data as APIError).error);
    }
    return data;
  } catch (error) {
    if (typeof error === "object" && error !== null && "response" in error) {
      const err = error as { response: { data?: { message?: string } } };
      console.error("Error fetching Profiles: ", err.response.data);
      throw new Error(err.response.data?.message || "Error fetching Profiles.");
    } else {
      const errMsg =
        typeof error === "object" && error !== null && "message" in error
          ? (error as { message?: string }).message
          : String(error);
      console.error("Network error while fetching Profiles: ", errMsg);
      throw new Error("Network error while fetching Profiles.");
    }
  }
}

export const useProfiles = () => {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles,
  });
};

import { useQuery } from "@tanstack/react-query";
import { getLastShot } from "../api/api";

export const QUERY_KEY_HISTORY_LAST_SHOT = "history_last_shot";
export const QUERY_KEY_HISTORY = "history";

export const useLastShot = () => {
  return useQuery({
    queryKey: [QUERY_KEY_HISTORY_LAST_SHOT],
    queryFn: () => getLastShot(),
    refetchInterval: 2000,
  });
};

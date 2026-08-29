import Api, { type HistoryEntry } from "@meticulous-home/espresso-api";
import { getStoredToken, clearToken } from "./pairing";

const getDevURL = () => {
  if (!import.meta.env.DEV || !import.meta.env.VITE_SERVER_URL) {
    return null;
  }
  let url = import.meta.env.VITE_SERVER_URL;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `http://${url}`;
  }
  return url;
};

export const SERVER_URL =
  typeof window !== "undefined"
    ? getDevURL() ||
      `${window.location.protocol}//${window.location.hostname}:${window.location.port}`
    : "http://localhost:8080";

export const WATCHER_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}/health`
    : "http://localhost:3000";

// The stored device token authorizes every REST call (attached as a bearer
// header by the client). If the machine answers 401 the token is stale/revoked:
// clear it and reload so the app drops back to the authorize screen instead of
// silently showing "Loading..." forever.
export const api = new Api(
  {
    onUnauthorized: () => {
      clearToken();
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    },
  },
  SERVER_URL,
  getStoredToken() || undefined,
);

export const getLastShot = async (): Promise<HistoryEntry | null> => {
  try {
    const response = await api.getLastShot();
    if (response.status === 200) {
      return response.data;
    }

    throw new Error(`Unexpected response status: ${response.status}`);
  } catch (error) {
    throw new Error(
      `Failed to fetch manufacturing schema: ${error || "Unknown error"}`,
    );
  }
};

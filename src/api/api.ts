import Api, { type HistoryEntry } from "@meticulous-home/espresso-api";

const getDevURL = () => {
  if (!import.meta.env.DEV || !import.meta.env.VITE_SERVER_URL) {
    return null;
  }
  let url = import.meta.env.VITE_SERVER_URL;
  if (!url.startsWith("http://") || !url.startsWith("https://")) {
    url = `http://${url}`;
  }
  return url;
};

export const SERVER_URL =
  typeof window !== "undefined"
    ? getDevURL() ||
      `${window.location.protocol}//${window.location.hostname}:${window.location.port}`
    : "http://localhost:8080";

export const api = new Api(undefined, SERVER_URL);

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

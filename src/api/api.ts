import Api from "@meticulous-home/espresso-api";

// Which machine the UI talks to. A production build is served by the machine
// and always talks to it: the page's own origin. Only the dev server lets you
// pick another machine, in order of precedence:
//   1. a ?machine=<ip or url> query parameter (saved, then removed from the URL)
//   2. the address saved from the connection dialog
//   3. SERVER_URL / VITE_SERVER_URL when the dev server was started
//   4. the page's own origin
export const CAN_CHANGE_MACHINE = import.meta.env.DEV;

const STORAGE_KEY = "meticulous:machine-url";

// "10.10.0.42", "10.10.0.42:8080" or "http://10.10.0.42/" -> "http://10.10.0.42"
export const normalizeMachineUrl = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
};

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStored = (url: string | null) => {
  try {
    if (url) localStorage.setItem(STORAGE_KEY, url);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not persisted; the address still applies to this visit.
  }
};

export const defaultMachineUrl = () =>
  (CAN_CHANGE_MACHINE &&
    normalizeMachineUrl(import.meta.env.VITE_SERVER_URL ?? "")) ||
  window.location.origin;

export const initialMachineUrl = (): string => {
  if (!CAN_CHANGE_MACHINE) return window.location.origin;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = normalizeMachineUrl(params.get("machine") ?? "");
  if (fromQuery) {
    writeStored(fromQuery);
    params.delete("machine");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );
    return fromQuery;
  }
  return normalizeMachineUrl(readStored() ?? "") ?? defaultMachineUrl();
};

// Saves an explicit address, or clears it (null) to go back to the default.
export const saveMachineUrl = (url: string | null) => {
  if (!CAN_CHANGE_MACHINE) return window.location.origin;
  writeStored(url);
  return url ?? defaultMachineUrl();
};

export const createApi = (machineUrl: string) => new Api(undefined, machineUrl);

// The system watcher (logs, archive) sits behind the machine's web server on
// the default port, next to the backend.
export const watcherUrl = (machineUrl: string) => {
  const url = new URL(machineUrl);
  return `${url.protocol}//${url.hostname}/health`;
};

// Profile images come back as paths relative to the machine.
export const profileImageUrl = (machineUrl: string, image?: string) => {
  if (!image) return undefined;
  if (image.startsWith("data:") || /^https?:\/\//.test(image)) return image;
  const path = image.startsWith("/api/")
    ? image
    : `/api/v1/profile/image/${image}`;
  return `${machineUrl}${path}`;
};

// Turns an axios/fetch failure into a sentence for the UI.
export const errorMessage = (error: unknown, fallback = "Request failed") => {
  if (typeof error === "object" && error !== null) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (data && typeof data === "object") {
      const {
        error: code,
        description,
        message,
      } = data as Record<string, unknown>;
      const text = description ?? message ?? code;
      if (typeof text === "string" && text) return text;
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
};

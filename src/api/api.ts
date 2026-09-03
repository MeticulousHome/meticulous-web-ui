import Api, {
  MachineIdentityError,
  type HistoryEntry,
} from "@meticulous-home/espresso-api";
import {
  clearCredential,
  getStoredCredential,
  storeCredential,
} from "./pairing";

const getDevURL = () => {
  if (!import.meta.env.DEV || !import.meta.env.VITE_SERVER_URL) return null;
  const value = import.meta.env.VITE_SERVER_URL;
  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `http://${value}`;
};

export const SERVER_URL =
  typeof window !== "undefined"
    ? getDevURL() || window.location.origin
    : "http://localhost:8080";

type VerifyResult =
  | "ok"
  | "no_identity"
  | "mismatch"
  | "unreachable"
  | "redirect";

export interface IdentityIssue {
  origin: string;
  result: VerifyResult;
}

let identityIssue: IdentityIssue | null = null;
const identityListeners = new Set<(issue: IdentityIssue | null) => void>();

const publishIdentityIssue = (issue: IdentityIssue | null) => {
  identityIssue = issue;
  for (const listener of identityListeners) listener(issue);
};

export const getIdentityIssue = () => identityIssue;
export const subscribeToIdentityIssue = (
  listener: (issue: IdentityIssue | null) => void,
) => {
  identityListeners.add(listener);
  listener(identityIssue);
  return () => identityListeners.delete(listener);
};

const handleUnauthorized = () => {
  const rejected = api.getCredential();
  const stored = getStoredCredential();
  if (!stored || (rejected && rejected.token === stored.token)) {
    clearCredential();
  }
  api.setCredential(undefined);
  if (typeof window !== "undefined") window.location.reload();
};

const handleIdentityChanged = (origin: string, result: VerifyResult) => {
  const credential = api.getCredential();
  if (credential) storeCredential({ ...credential, state: "identity_changed" });
  publishIdentityIssue({ origin, result });
};

const initialCredential = getStoredCredential();

export const api = new Api(
  {
    onUnauthorized: handleUnauthorized,
    onIdentityChanged: handleIdentityChanged,
  },
  SERVER_URL,
);
api.setCredential(initialCredential);

export const markIdentityRecovered = () => {
  const credential = api.getCredential();
  if (credential) storeCredential({ ...credential, state: "ok" });
  publishIdentityIssue(null);
};

// The shared API does not expose watcher downloads. Gate the fetch with its
// identity state machine, then keep redirects disabled and attach only the
// credential that was just verified.
export const verifiedMachineFetch = async (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const result = await api.ensureVerified();
  if (result !== "ok") {
    handleIdentityChanged(new URL(SERVER_URL).origin, result);
    throw new MachineIdentityError(result, new URL(SERVER_URL).origin);
  }
  const credential = api.getCredential();
  const headers = new Headers(init.headers);
  if (credential) headers.set("Authorization", `Bearer ${credential.token}`);
  const response = await fetch(new URL(path, SERVER_URL), {
    ...init,
    headers,
    redirect: "error",
  });
  if (response.status === 401) handleUnauthorized();
  return response;
};

export const getLastShot = async (): Promise<HistoryEntry | null> => {
  try {
    const response = await api.getLastShot();
    if (response.status === 200) return response.data;
    throw new Error(`Unexpected response status: ${response.status}`);
  } catch (error) {
    throw new Error(
      `Failed to fetch manufacturing schema: ${error || "Unknown error"}`,
    );
  }
};

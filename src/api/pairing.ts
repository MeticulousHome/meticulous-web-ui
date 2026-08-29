// Device pairing for the web-app. The machine's local API authenticates LAN
// clients with a per-device token obtained by approving on the machine screen.
// These calls are same-origin (served by the machine) and need no token; the
// resulting token is stored in this origin's localStorage and reused.

const TOKEN_KEY = "meticulous.deviceToken";

// Same-origin base. Using location.origin avoids the trailing-colon quirk of the
// port-suffixed SERVER_URL when served on :80.
const base = () =>
  typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:8080";

export const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const storeToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage unavailable (private mode, etc.) - the token just won't
    // persist across reloads; the current session still works.
  }
};

export const clearToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
};

export interface PairingRequest {
  pairing_id: string;
  expires_in: number;
}

export async function requestPairing(
  deviceName: string,
): Promise<PairingRequest> {
  const res = await fetch(`${base()}/api/v1/pair/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_name: deviceName }),
  });
  if (res.status === 429) {
    throw new Error("Too many attempts. Wait a moment and try again.");
  }
  if (!res.ok) {
    throw new Error("Could not reach the machine.");
  }
  return res.json();
}

export async function verifyPairingCode(
  pairingId: string,
  code: string,
): Promise<string> {
  const res = await fetch(`${base()}/api/v1/pair/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairing_id: pairingId, code }),
  });
  if (res.status === 401) {
    throw new Error("That code is wrong or expired.");
  }
  if (!res.ok) {
    throw new Error("Could not verify the code.");
  }
  const data = await res.json();
  return data.token as string;
}

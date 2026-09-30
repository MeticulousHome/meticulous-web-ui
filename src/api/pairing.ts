// Persist the machine identity and bearer as one credential. The raw-token key
// and cookie are deliberately removed: neither can be gated by an identity
// challenge before the browser attaches it.

export const MACHINE_CREDENTIAL_KEY = "meticulous.machineCredential";
const LEGACY_TOKEN_KEY = "meticulous.deviceToken";

export interface StoredMachineCredential {
  serial: string;
  fingerprint: string;
  publicKey: string;
  token: string;
  lastOrigin?: string;
  state?: "ok" | "identity_changed";
}

const clearLegacyArtifacts = () => {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Storage may be unavailable in private/restricted contexts.
  }
  try {
    document.cookie = "met_device_token=; Path=/; Max-Age=0; SameSite=Strict";
  } catch {
    // document is unavailable during non-browser builds.
  }
};

export const getStoredCredential = (): StoredMachineCredential | undefined => {
  clearLegacyArtifacts();
  try {
    const value = localStorage.getItem(MACHINE_CREDENTIAL_KEY);
    if (!value) return undefined;
    const raw = JSON.parse(value) as Partial<StoredMachineCredential> & {
      public_key?: string;
      last_origin?: string;
    };
    const credential: StoredMachineCredential = {
      serial: raw.serial ?? "",
      fingerprint: raw.fingerprint ?? "",
      publicKey: raw.publicKey ?? raw.public_key ?? "",
      token: raw.token ?? "",
      lastOrigin: raw.lastOrigin ?? raw.last_origin,
      state: raw.state,
    };
    if (
      !credential.serial ||
      !credential.fingerprint ||
      !credential.publicKey ||
      !credential.token
    ) {
      localStorage.removeItem(MACHINE_CREDENTIAL_KEY);
      return undefined;
    }
    return credential;
  } catch {
    return undefined;
  }
};

export const storeCredential = (credential: StoredMachineCredential): void => {
  clearLegacyArtifacts();
  localStorage.setItem(MACHINE_CREDENTIAL_KEY, JSON.stringify(credential));
};

export const clearCredential = (): void => {
  try {
    localStorage.removeItem(MACHINE_CREDENTIAL_KEY);
  } finally {
    clearLegacyArtifacts();
  }
};

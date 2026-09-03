import { useRef, useState } from "react";
import { MachineIdentityError } from "@meticulous-home/espresso-api";
import { api, markIdentityRecovered } from "../api/api";
import {
  getStoredCredential,
  storeCredential,
  type StoredMachineCredential,
} from "../api/pairing";

// Shown when the machine has not authorized this device. It never leaves the
// user staring at a blank/broken screen: it explains why nothing is working and
// walks them through authorizing from the machine's own display.
export function AuthorizeGate({
  reason,
}: {
  reason: "unauthorized" | "identity_changed" | "error";
}) {
  const [step, setStep] = useState<"intro" | "code">("intro");
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const previousCredential = useRef<StoredMachineCredential | undefined>(
    undefined,
  );

  const start = async () => {
    setBusy(true);
    setMessage(null);
    try {
      previousCredential.current = getStoredCredential();
      // Pairing a legitimately reset machine must not be blocked by the old
      // pin. Keep it persisted until the replacement proves itself.
      if (reason === "identity_changed") {
        api.disconnectSocket();
        api.setCredential(undefined);
      }
      const response = await api.requestPairing("Web browser");
      if (!("pairing_id" in response.data)) {
        throw new Error(response.data.error || "Could not reach the machine.");
      }
      setPairingId(response.data.pairing_id);
      setStep("code");
    } catch (e) {
      if (previousCredential.current)
        api.setCredential(previousCredential.current);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const digits = code.replace(/[^0-9]/g, "");
    if (digits.length !== 6) {
      setMessage("Enter the 6-digit code shown on your machine.");
      return;
    }
    if (!pairingId) return;
    setBusy(true);
    setMessage(null);
    try {
      const credential = await api.completePairing(pairingId, digits);
      storeCredential(credential);
      markIdentityRecovered();
      // Reload so every client (socket + API) reconnects with the token.
      window.location.reload();
    } catch (e) {
      setMessage(
        e instanceof MachineIdentityError
          ? "The machine could not prove its saved identity. No authorization was stored."
          : (e as Error).message,
      );
      setBusy(false);
    }
  };

  const retryIdentity = async () => {
    const credential = getStoredCredential();
    if (!credential) return;
    setBusy(true);
    setMessage(null);
    api.setCredential(credential);
    const result = await api.ensureVerified();
    if (result === "ok") {
      storeCredential({ ...credential, state: "ok" });
      markIdentityRecovered();
      window.location.reload();
      return;
    }
    setMessage(
      result === "unreachable"
        ? "The saved machine is still unreachable."
        : "This address still does not match the saved machine identity.",
    );
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-7">
        <h1 className="text-xl font-semibold mb-1">
          {reason === "identity_changed"
            ? "Machine identity changed"
            : "Authorize this device"}
        </h1>

        {reason === "identity_changed" && (
          <p className="text-red-400 text-sm mb-4">
            This address no longer proves the identity saved for your machine.
            Your authorization was withheld and remains stored. Pair again only
            if you are at the machine and can see its code.
          </p>
        )}

        {reason === "error" && (
          <p className="text-red-400 text-sm mb-4">
            Can&apos;t reach the machine right now. Check that you are on the
            same network as your Meticulous, then try again.
          </p>
        )}

        {step === "intro" && (
          <>
            <p className="text-gray-400 text-sm mb-5">
              {reason === "identity_changed"
                ? "Pair again to replace the saved identity. The machine will show a 6-digit code on its screen."
                : "This device isn’t authorized to talk to your Meticulous machine yet, so nothing can load. Authorize it to continue: the machine will show a 6-digit code on its screen."}
            </p>
            <button
              onClick={start}
              disabled={busy}
              className="w-full rounded-lg bg-red-600 py-3 font-semibold disabled:opacity-50"
            >
              {busy
                ? "Contacting the machine..."
                : reason === "identity_changed"
                  ? "Pair again"
                  : "Authorize this device"}
            </button>
            {reason === "identity_changed" && (
              <button
                onClick={retryIdentity}
                disabled={busy}
                className="mt-3 w-full rounded-lg border border-gray-600 py-3 font-semibold disabled:opacity-50"
              >
                Try the saved machine again
              </button>
            )}
          </>
        )}

        {step === "code" && (
          <>
            <p className="text-gray-400 text-sm mb-4">
              Your machine is showing a 6-digit code. Enter it below to finish.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") verify();
              }}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              aria-label="Code shown on the machine screen"
              className="w-full text-center text-2xl tracking-[0.35em] tabular-nums rounded-lg border border-gray-600 bg-gray-800 py-3 mb-4"
            />
            <button
              onClick={verify}
              disabled={busy}
              className="w-full rounded-lg bg-red-600 py-3 font-semibold disabled:opacity-50"
            >
              {busy ? "Checking..." : "Authorize"}
            </button>
          </>
        )}

        {message && (
          <p className="text-red-400 text-sm mt-4" role="status">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

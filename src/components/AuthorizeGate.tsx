import { useState } from "react";
import { requestPairing, verifyPairingCode, storeToken } from "../api/pairing";

// Shown when the machine has not authorized this device. It never leaves the
// user staring at a blank/broken screen: it explains why nothing is working and
// walks them through authorizing from the machine's own display.
export function AuthorizeGate({
  reason,
}: {
  reason: "unauthorized" | "error";
}) {
  const [step, setStep] = useState<"intro" | "code">("intro");
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const req = await requestPairing(
        navigator.userAgent.slice(0, 60) || "Web browser",
      );
      setPairingId(req.pairing_id);
      setStep("code");
    } catch (e) {
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
      const token = await verifyPairingCode(pairingId, digits);
      storeToken(token);
      // Reload so every client (socket + API) reconnects with the token.
      window.location.reload();
    } catch (e) {
      setMessage((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-7">
        <h1 className="text-xl font-semibold mb-1">Authorize this device</h1>

        {reason === "error" && (
          <p className="text-red-400 text-sm mb-4">
            Can&apos;t reach the machine right now. Check that you are on the
            same network as your Meticulous, then try again.
          </p>
        )}

        {step === "intro" && (
          <>
            <p className="text-gray-400 text-sm mb-5">
              This device isn&apos;t authorized to talk to your Meticulous
              machine yet, so nothing can load. Authorize it to continue: the
              machine will show a 6-digit code on its screen.
            </p>
            <button
              onClick={start}
              disabled={busy}
              className="w-full rounded-lg bg-red-600 py-3 font-semibold disabled:opacity-50"
            >
              {busy ? "Contacting the machine..." : "Authorize this device"}
            </button>
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

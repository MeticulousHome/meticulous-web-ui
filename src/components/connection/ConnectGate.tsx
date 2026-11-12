import { useEffect, useId, useRef, useState } from "react";
import { CircleAlert, Hand, KeyRound } from "lucide-react";
import type { AxiosResponse } from "axios";
import { useMachine } from "../../contexts/MachineProvider";
import { deviceName } from "../../api/api";
import {
  requestDeadline,
  resumableRequest,
  type PendingRequest,
} from "../../lib/accessGate";
import { normalizePairingCode } from "../../lib/deviceAuth";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

type Step =
  | { kind: "idle" }
  | { kind: "asking" }
  | ({ kind: "waiting" } & PendingRequest)
  | { kind: "exchanging" }
  | { kind: "problem"; title: string; detail: string };

const UNREACHABLE =
  "The machine didn’t answer. Check that it’s on and on the same network, then try again.";

const waitText = (response: AxiosResponse) => {
  const seconds = Number(response.headers["retry-after"]);
  return Number.isFinite(seconds) && seconds > 0
    ? `Try again in ${Math.ceil(seconds)} seconds.`
    : "Wait a minute, then try again.";
};

// Shown in place of the page while the machine requires authorization and
// this browser isn't allowed. Asking for access puts an Allow / Deny question
// on the machine; a pairing code from a QR code works too.
export const ConnectGate = () => {
  const { api, signIn } = useMachine();
  const [name] = useState(deviceName);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [submittingCode, setSubmittingCode] = useState(false);
  const codeId = useId();
  // The request the user stopped waiting for with Cancel. It stays open on
  // the machine, which refuses a new one until it ends, so asking again
  // picks it back up; forgotten once the machine answers it.
  const cancelledRequest = useRef<PendingRequest | null>(null);

  // Trades a pairing code for this browser's token. Returns why it failed,
  // or null once signed in (the gate then goes away).
  const redeem = async (pairingCode: string): Promise<string | null> => {
    try {
      const response = await api.exchangePairingCode(pairingCode, name);
      const { status, data } = response;
      if (status === 200 && "token" in data && data.token) {
        signIn(data.token);
        return null;
      }
      if (status === 401 || status === 400)
        return "That code is wrong or no longer valid. Codes work once, for 10 minutes.";
      if (status === 429) return `Too many wrong codes. ${waitText(response)}`;
      return "The machine didn’t accept the code. Try again.";
    } catch {
      return UNREACHABLE;
    }
  };

  // The machine said yes and handed over a code. Leaving the waiting step
  // ends the polling, so this runs on its own.
  const redeemApproved = async (approvedCode: string) => {
    setStep({ kind: "exchanging" });
    const problem = await redeem(approvedCode);
    if (problem) {
      setStep({
        kind: "problem",
        title: "Allowed, but connecting failed",
        detail: problem,
      });
    }
  };

  const requestAccess = async () => {
    const open = resumableRequest(cancelledRequest.current, Date.now());
    if (open) {
      setStep({ kind: "waiting", ...open });
      return;
    }
    // Past its deadline the machine has let it expire.
    cancelledRequest.current = null;
    setStep({ kind: "asking" });
    try {
      const response = await api.requestAccess(name);
      const { status, data } = response;
      if (status === 202 && "id" in data) {
        setStep({
          kind: "waiting",
          id: data.id,
          deadline: requestDeadline(data.expires_in, Date.now()),
        });
        return;
      }
      // A request this browser cancelled is picked back up above while the
      // machine may still hold it, so this one belongs to another device.
      if (status === 409) {
        setStep({
          kind: "problem",
          title: "Another request is waiting on the machine",
          detail:
            "Answer it on the machine, or wait a minute for it to time out, then ask again.",
        });
        return;
      }
      if (status === 429) {
        setStep({
          kind: "problem",
          title: "Too many requests",
          detail: waitText(response),
        });
        return;
      }
      setStep({
        kind: "problem",
        title: "The machine didn’t accept the request",
        detail: "Try again, or enter a pairing code instead.",
      });
    } catch {
      setStep({
        kind: "problem",
        title: "Can’t reach the machine",
        detail: UNREACHABLE,
      });
    }
  };

  // While the question is up on the machine, ask about once a second
  // whether someone answered it.
  useEffect(() => {
    if (step.kind !== "waiting") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The machine answered (or let it expire): nothing left to resume.
    const ended = () => {
      if (cancelledRequest.current?.id === step.id)
        cancelledRequest.current = null;
    };

    const expired = () =>
      setStep({
        kind: "problem",
        title: "Nobody answered on the machine",
        detail: "Ask again and press Allow on the machine within a minute.",
      });

    const poll = async () => {
      let answer: string | null = null;
      let approvedCode: string | null = null;
      try {
        const { status, data } = await api.getAccessRequest(step.id);
        // The machine forgets requests a while after they end.
        if (status === 404) answer = "expired";
        else if (status === 200 && "status" in data) {
          answer = data.status;
          if (data.status === "approved") approvedCode = data.code;
        }
      } catch {
        // A dropped poll; the next one may get through.
      }
      if (stopped) return;

      if (approvedCode) {
        ended();
        redeemApproved(approvedCode);
      } else if (answer === "denied") {
        ended();
        setStep({
          kind: "problem",
          title: "The request was denied",
          detail: "Someone pressed Deny on the machine.",
        });
      } else if (answer === "expired" || Date.now() > step.deadline) {
        ended();
        expired();
      } else {
        timer = setTimeout(poll, 1000);
      }
    };

    timer = setTimeout(poll, 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [step, api, name, signIn]);

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizePairingCode(code);
    if (!normalized) {
      setCodeError("A code has 8 letters and digits, like ABCD-EFGH.");
      return;
    }
    setSubmittingCode(true);
    setCodeError(null);
    const problem = await redeem(normalized);
    // On success the gate unmounts; only a failure needs the form again.
    if (problem) {
      setCodeError(problem);
      setSubmittingCode(false);
    }
  };

  const busy = step.kind === "asking" || step.kind === "exchanging";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-14 sm:py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-raised text-ink-2">
          <KeyRound size={22} />
        </span>
        <h1 className="text-2xl font-light tracking-[-0.01em] text-ink">
          Connect to this machine
        </h1>
        <p className="text-sm leading-relaxed text-ink-2">
          This machine only works with devices it has allowed. Ask for access
          and confirm on the machine, or enter a pairing code.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
        {step.kind === "waiting" || step.kind === "exchanging" ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            {step.kind === "waiting" ? (
              <Hand size={28} className="text-ink-2" />
            ) : (
              <Spinner className="size-6 text-ink-2" />
            )}
            <p className="text-base text-ink" role="status">
              {step.kind === "waiting"
                ? "Press Allow on your machine"
                : "Connecting…"}
            </p>
            {step.kind === "waiting" && (
              <>
                <p className="text-sm text-ink-2">
                  The machine asks whether “{name}” may use it.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    cancelledRequest.current = {
                      id: step.id,
                      deadline: step.deadline,
                    };
                    setStep({ kind: "idle" });
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            {step.kind === "problem" && (
              <div
                role="alert"
                className="flex gap-3 rounded-lg bg-raised px-3 py-2.5 text-sm"
              >
                <CircleAlert size={16} className="mt-0.5 shrink-0 text-bad" />
                <div>
                  <p className="text-ink">{step.title}</p>
                  <p className="mt-0.5 text-ink-2">{step.detail}</p>
                </div>
              </div>
            )}
            <Button
              variant="primary"
              size="lg"
              loading={busy}
              onClick={requestAccess}
            >
              {step.kind === "problem" ? "Ask again" : "Request access"}
            </Button>
            <p className="text-center text-xs text-ink-3">
              The machine will show this browser as “{name}”.
            </p>
          </>
        )}
      </section>

      {codeOpen ? (
        <form
          onSubmit={submitCode}
          className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5"
        >
          <label htmlFor={codeId} className="text-sm text-ink-2">
            Pairing code
          </label>
          <div className="flex gap-2">
            <input
              id={codeId}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setCodeError(null);
              }}
              placeholder="ABCD-EFGH"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
              autoFocus
              className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-canvas px-3 font-mono text-sm tracking-wider text-ink placeholder:text-ink-3 focus:border-ink-2 focus:outline-none"
            />
            <Button type="submit" variant="primary" loading={submittingCode}>
              Connect
            </Button>
          </div>
          <p className="text-xs text-ink-3">
            The 8-character code shown under a pairing QR code, on the machine
            or on a phone that already has access.
          </p>
          {codeError && <p className="text-sm text-bad">{codeError}</p>}
        </form>
      ) : (
        <Button
          variant="ghost"
          className="self-center"
          onClick={() => setCodeOpen(true)}
        >
          Enter code
        </Button>
      )}
    </div>
  );
};

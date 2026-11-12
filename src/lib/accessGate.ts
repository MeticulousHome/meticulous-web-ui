// Rules behind the connect screen, with no imports so tests can load them on
// their own. MachineProvider decides when the screen shows; ConnectGate asks
// the machine for access.

// The machine and token the page uses right now.
export interface DeviceSession {
  machineUrl: string;
  token?: string;
}

// Holds the machine and token in use, switched the moment either changes.
// React state only catches up after a re-render, and until then an older
// socket or request can still report that the machine refused it; comparing
// that refusal against React state would wipe a token that was just issued.
export const createDeviceSession = (machineUrl: string, token?: string) => {
  let current: DeviceSession = { machineUrl, token };
  return {
    get current(): DeviceSession {
      return current;
    },
    apply(nextUrl: string, nextToken: string | undefined) {
      current = { machineUrl: nextUrl, token: nextToken };
    },
    // Whether a refusal of `used` by `url` is about the token in use now.
    // Otherwise it answers a token (or the lack of one) already replaced.
    isCurrent(url: string, used: string | undefined) {
      return url === current.machineUrl && used === current.token;
    },
  };
};

// What GET /api/v1/auth/validate said about this browser's token.
// "absent": the machine has no device authorization (404, older backend).
// "unknown": no answer we understand (network error, timeout, 5xx).
export type Access = "allowed" | "denied" | "absent" | "unknown";

export const accessFromStatus = (status: number | undefined): Access => {
  if (status === 200) return "allowed";
  if (status === 401) return "denied";
  if (status === 404) return "absent";
  return "unknown";
};

// How often the machine is asked again while the connect screen is up.
export const RECHECK_MS = 5000;

export interface AfterCheck {
  // Forget the stored token and show the connect screen.
  forgetToken: boolean;
  // Leave the connect screen.
  clearGate: boolean;
  // Ask again in RECHECK_MS.
  recheck: boolean;
}

// What the page does with an answer from validate. `gated`: the connect
// screen is up. While it is, every answer short of "allowed" is asked again,
// or one failed check (the machine rebooting after an update, a Wi-Fi blip)
// would leave the screen up until a reload, even once authorization is
// turned off on the machine.
export const afterAccessCheck = (
  access: Access,
  gated: boolean,
): AfterCheck => {
  switch (access) {
    case "allowed":
      return { forgetToken: false, clearGate: true, recheck: false };
    case "denied":
      return { forgetToken: true, clearGate: false, recheck: true };
    case "absent":
      // A machine without device authorization admits everyone, for
      // example after a downgrade; asking again would never clear the gate.
      return { forgetToken: false, clearGate: gated, recheck: false };
    case "unknown":
      // Without the gate the page carries on as it always did.
      return { forgetToken: false, clearGate: false, recheck: gated };
  }
};

// An access request open on the machine, and when this browser stops
// waiting for it.
export interface PendingRequest {
  id: string;
  deadline: number;
}

// How long the machine keeps a request open when it doesn't say.
const DEFAULT_REQUEST_SECONDS = 60;
// Extra wait, so the machine's own "expired" normally arrives first.
const REQUEST_SLACK_SECONDS = 10;

// When to stop waiting for a request the machine keeps open `expiresIn`
// seconds. Always later than the machine lets it expire, so after it a
// "request pending" answer is never about this browser's request.
export const requestDeadline = (expiresIn: number, now: number): number =>
  now +
  ((expiresIn > 0 ? expiresIn : DEFAULT_REQUEST_SECONDS) +
    REQUEST_SLACK_SECONDS) *
    1000;

// Cancel on the connect screen only stops waiting: the machine has no way to
// withdraw a request, so the question stays up and a new one is refused with
// 409 until it ends. Asking again resumes the remembered request while the
// machine may still answer it; null when there is none or it has run out.
export const resumableRequest = (
  remembered: PendingRequest | null,
  now: number,
): PendingRequest | null =>
  remembered && now < remembered.deadline ? remembered : null;

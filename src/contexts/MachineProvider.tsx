import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import type Api from "@meticulous-home/espresso-api";
import type { StatusData } from "@meticulous-home/espresso-api";
import {
  createApi,
  deviceName,
  initialMachineUrl,
  saveMachineUrl,
  takePairCodeFromLocation,
  watcherUrl,
} from "../api/api";
import {
  accessFromStatus,
  afterAccessCheck,
  createDeviceSession,
  RECHECK_MS,
  type Access,
} from "../lib/accessGate";
import { readDeviceToken, writeDeviceToken } from "../lib/deviceAuth";
import { LiveStore, type SensorPayload } from "../lib/liveStore";
import { useToast } from "../components/ui/Toast";

// "unauthorized": the machine requires authorization and this browser isn't
// allowed (yet); the page shows the connect screen instead of its content.
export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "unauthorized";

interface MachineContextValue {
  machineUrl: string;
  watcherUrl: string;
  api: Api;
  live: LiveStore;
  connection: ConnectionState;
  // This browser's token for the machine, if it has one. Only for requests
  // that bypass the API client; never show or log it.
  token?: string;
  // True while the first check of whether this browser is allowed runs.
  checkingAccess: boolean;
  // Point the UI at another machine; null goes back to the default address.
  setMachineUrl: (url: string | null) => void;
  // Keeps a token the machine just issued and leaves the connect screen.
  signIn: (token: string) => void;
  // Forgets this browser's token for the machine.
  signOut: () => void;
}

const MachineContext = createContext<MachineContextValue | null>(null);

// "notification" arrives as a JSON string: { id, message, image, ... }.
const notificationText = (payload: unknown) => {
  try {
    const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    const message = (parsed as { message?: unknown })?.message;
    return typeof message === "string" && message ? message : null;
  } catch {
    return null;
  }
};

// Asks the machine whether it admits this browser with its current token.
const checkAccess = async (api: Api): Promise<Access> => {
  try {
    const { status } = await api.validateToken();
    return accessFromStatus(status);
  } catch {
    // Unreachable, or an answer we don't know.
    return "unknown";
  }
};

type PairOutcome =
  | "paired"
  | "invalid"
  | "throttled"
  | "unsupported"
  | "failed"
  | "none";

// Don't hold the page (its content, or its socket while a pair link is
// exchanged) back for longer than this when the machine doesn't answer.
const PAGE_WAIT_MS = 4000;

const PAIR_MESSAGES: Partial<Record<PairOutcome, string>> = {
  invalid:
    "That pairing link has expired or was already used. Ask for access instead.",
  throttled: "Too many pairing attempts. Wait a minute and try again.",
  failed: "The pairing link didn’t work: the machine didn’t answer.",
};

// The code from a pair URL is taken before the first render, so it never
// reaches the hash routes, and exchanged once. The exchange is shared, so a
// remounted provider (React's development double render) doesn't spend the
// one-time code twice; the token lands in storage either way.
const fragmentPairCode = takePairCodeFromLocation();
let fragmentPairing: {
  machineUrl: string;
  outcome: Promise<PairOutcome>;
} | null = null;
let fragmentReported = false;

const exchangeFragmentCode = async (
  machineUrl: string,
  code: string,
): Promise<PairOutcome> => {
  try {
    const { status, data } = await createApi(machineUrl).exchangePairingCode(
      code,
      deviceName(),
    );
    if (status === 200 && "token" in data && data.token) {
      writeDeviceToken(machineUrl, data.token);
      return "paired";
    }
    if (status === 400 || status === 401) return "invalid";
    if (status === 429) return "throttled";
    if (status === 404) return "unsupported";
  } catch {
    // Unreachable; reported below.
  }
  return "failed";
};

const pairFromFragment = (machineUrl: string): Promise<PairOutcome> => {
  if (!fragmentPairCode) return Promise.resolve("none");
  fragmentPairing ??= {
    machineUrl,
    outcome: exchangeFragmentCode(machineUrl, fragmentPairCode),
  };
  return fragmentPairing.machineUrl === machineUrl
    ? fragmentPairing.outcome
    : Promise.resolve("none");
};

export const MachineProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const queryClient = useQueryClient();
  const notify = useToast();
  const [machineUrl, setMachineUrlState] = useState(initialMachineUrl);
  const [token, setToken] = useState(() => readDeviceToken(machineUrl));
  // Set when the machine refuses this browser; cleared once it's allowed.
  const [needsPairing, setNeedsPairing] = useState(false);
  const [checkedUrl, setCheckedUrl] = useState<string | null>(null);
  // A pair link is exchanged before the socket opens, so the first handshake
  // already carries its token instead of being refused without one.
  const [linkPending, setLinkPending] = useState(
    () => fragmentPairCode !== null && !fragmentReported,
  );
  const [socketState, setSocketState] =
    useState<Exclude<ConnectionState, "unauthorized">>("connecting");
  const [live] = useState(() => new LiveStore());

  // The latest machine and token, for callbacks from older clients and
  // sockets that may still answer after either changed. Every change goes
  // through applyToken, which switches it before React re-renders.
  const [session] = useState(() => createDeviceSession(machineUrl, token));
  const applyToken = useCallback(
    (url: string, next: string | undefined) => {
      session.apply(url, next);
      setToken(next);
    },
    [session],
  );

  // The machine refused the token it was sent (or the lack of one): forget
  // it and show the connect screen. Ignored when it was about a token this
  // browser has already replaced.
  const dropToken = useCallback(
    (url: string, used: string | undefined) => {
      if (!session.isCurrent(url, used)) return;
      writeDeviceToken(url, undefined);
      applyToken(url, undefined);
      setNeedsPairing(true);
    },
    [session, applyToken],
  );

  const api = useMemo(
    () => createApi(machineUrl, token, () => dropToken(machineUrl, token)),
    [machineUrl, token, dropToken],
  );

  // Queries are keyed by machine, not by token: once the token changes,
  // refetch what was loaded (or refused) with the old one. This runs after
  // the queries picked up the new client.
  const lastToken = useRef(token);
  useEffect(() => {
    if (lastToken.current === token) return;
    lastToken.current = token;
    queryClient.invalidateQueries();
  }, [token, queryClient]);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setTimeout> | undefined;
    const giveUp = setTimeout(() => setCheckedUrl(machineUrl), PAGE_WAIT_MS);

    const check = async () => {
      const access = await checkAccess(api);
      if (cancelled) return;
      clearTimeout(giveUp);
      setCheckedUrl(machineUrl);
      // While the connect screen is up it keeps asking, so it goes away by
      // itself if authorization is turned off on the machine.
      const next = afterAccessCheck(access, needsPairing);
      if (next.forgetToken) dropToken(machineUrl, token);
      if (next.clearGate) setNeedsPairing(false);
      if (next.recheck) poll = setTimeout(check, RECHECK_MS);
    };

    const start = async () => {
      const outcome = await pairFromFragment(machineUrl);
      if (cancelled) return;
      setLinkPending(false);
      if (outcome !== "none" && !fragmentReported) {
        fragmentReported = true;
        const paired = readDeviceToken(machineUrl);
        if (outcome === "paired" && paired && paired !== token) {
          notify("This browser can now use the machine.", "success");
          applyToken(machineUrl, paired);
          setNeedsPairing(false);
          // The new token starts a fresh check.
          return;
        }
        const message = PAIR_MESSAGES[outcome];
        if (message) notify(message, "error");
      }
      await check();
    };
    start();

    return () => {
      cancelled = true;
      clearTimeout(giveUp);
      clearTimeout(poll);
    };
  }, [api, machineUrl, token, needsPairing, dropToken, applyToken, notify]);

  useEffect(() => {
    if (!linkPending) return;
    const stop = setTimeout(() => setLinkPending(false), PAGE_WAIT_MS);
    return () => clearTimeout(stop);
  }, [linkPending]);

  useEffect(() => {
    // Without access the machine refuses the socket too; wait for a token.
    if (needsPairing || linkPending) return;
    live.reset();
    setSocketState("connecting");
    const socket: Socket = io(machineUrl, {
      transports: ["websocket"],
      reconnectionDelayMax: 4000,
      auth: (send) => send(token ? { token } : {}),
    });
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    socket.on("connect", () => setSocketState("connected"));
    socket.on("disconnect", (reason) => {
      setSocketState("disconnected");
      // socket.io doesn't come back by itself after the machine closed the
      // connection, which it does when this browser loses access (sign out
      // of all devices, authorization turned on). Try again: the handshake
      // then either succeeds or says "unauthorized".
      if (reason === "io server disconnect") {
        reconnect = setTimeout(() => socket.connect(), 1000);
      }
    });
    socket.on("connect_error", (error) => {
      // The machine refuses the handshake with exactly "unauthorized" when
      // this browser isn't allowed. socket.io doesn't retry that by itself;
      // a new socket opens once there is a token.
      if (error.message === "unauthorized") dropToken(machineUrl, token);
      else setSocketState("disconnected");
    });
    socket.on("status", (data: StatusData) => live.pushStatus(data));
    socket.on("sensors", (data: SensorPayload) => live.pushSensors(data));
    socket.on("heater_status", (remaining: unknown) =>
      live.pushHeaterStatus(remaining),
    );
    // Profile saved, deleted, loaded or reordered on the machine.
    socket.on("profile", () => {
      queryClient.invalidateQueries({ queryKey: [machineUrl, "profiles"] });
      queryClient.invalidateQueries({ queryKey: [machineUrl, "settings"] });
    });
    socket.on("settings", () =>
      queryClient.invalidateQueries({ queryKey: [machineUrl, "settings"] }),
    );
    socket.on("notification", (payload: unknown) => {
      const message = notificationText(payload);
      if (message) notify(message);
    });
    return () => {
      clearTimeout(reconnect);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [
    machineUrl,
    token,
    needsPairing,
    linkPending,
    live,
    queryClient,
    notify,
    dropToken,
  ]);

  const setMachineUrl = useCallback(
    (url: string | null) => {
      const next = saveMachineUrl(url);
      setMachineUrlState(next);
      applyToken(next, readDeviceToken(next));
      setNeedsPairing(false);
    },
    [applyToken],
  );

  const signIn = useCallback(
    (next: string) => {
      writeDeviceToken(machineUrl, next);
      applyToken(machineUrl, next);
      setNeedsPairing(false);
    },
    [machineUrl, applyToken],
  );

  const signOut = useCallback(() => {
    writeDeviceToken(machineUrl, undefined);
    applyToken(machineUrl, undefined);
  }, [machineUrl, applyToken]);

  const connection: ConnectionState = needsPairing
    ? "unauthorized"
    : socketState;
  const checkingAccess = checkedUrl !== machineUrl;

  const value = useMemo(
    () => ({
      machineUrl,
      watcherUrl: watcherUrl(machineUrl),
      api,
      live,
      connection,
      token,
      checkingAccess,
      setMachineUrl,
      signIn,
      signOut,
    }),
    [
      machineUrl,
      api,
      live,
      connection,
      token,
      checkingAccess,
      setMachineUrl,
      signIn,
      signOut,
    ],
  );

  return (
    <MachineContext.Provider value={value}>{children}</MachineContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useMachine = () => {
  const context = useContext(MachineContext);
  if (!context) throw new Error("useMachine needs a <MachineProvider>");
  return context;
};

// The latest "status" message (10 Hz). Re-renders on every message.
// eslint-disable-next-line react-refresh/only-export-components
export const useLiveStatus = () => {
  const { live } = useMachine();
  return useSyncExternalStore(live.subscribeStatus, () => live.status);
};

// One field of the latest status, re-rendering only when it changes. The
// selector must return a primitive (string, number, boolean, undefined).
// eslint-disable-next-line react-refresh/only-export-components
export const useStatusField = <
  T extends string | number | boolean | null | undefined,
>(
  selector: (status: StatusData | null) => T,
) => {
  const { live } = useMachine();
  return useSyncExternalStore(live.subscribeStatus, () =>
    selector(live.status),
  );
};

// The latest raw "sensors" message (10 Hz). Re-renders on every message.
// eslint-disable-next-line react-refresh/only-export-components
export const useLiveSensors = () => {
  const { live } = useMachine();
  return useSyncExternalStore(live.subscribeSensors, () => live.sensors);
};

// Seconds of preheat left (0 when not preheating).
// eslint-disable-next-line react-refresh/only-export-components
export const usePreheatRemaining = () => {
  const { live } = useMachine();
  return useSyncExternalStore(
    live.subscribeStatus,
    () => live.preheatRemaining,
  );
};

// Version counter of the shot being recorded from the status stream.
// eslint-disable-next-line react-refresh/only-export-components
export const useLiveShotVersion = () => {
  const { live } = useMachine();
  return useSyncExternalStore(live.subscribeStatus, () => live.liveShotVersion);
};

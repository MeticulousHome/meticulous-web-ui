import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import type Api from "@meticulous-home/espresso-api";
import type { StatusData } from "@meticulous-home/espresso-api";
import {
  createApi,
  initialMachineUrl,
  saveMachineUrl,
  watcherUrl,
} from "../api/api";
import { LiveStore, type SensorPayload } from "../lib/liveStore";
import { useToast } from "../components/ui/Toast";

export type ConnectionState = "connecting" | "connected" | "disconnected";

interface MachineContextValue {
  machineUrl: string;
  watcherUrl: string;
  api: Api;
  live: LiveStore;
  connection: ConnectionState;
  // Point the UI at another machine; null goes back to the default address.
  setMachineUrl: (url: string | null) => void;
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

export const MachineProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const queryClient = useQueryClient();
  const notify = useToast();
  const [machineUrl, setMachineUrlState] = useState(initialMachineUrl);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [live] = useState(() => new LiveStore());
  const api = useMemo(() => createApi(machineUrl), [machineUrl]);

  useEffect(() => {
    live.reset();
    setConnection("connecting");
    const socket: Socket = io(machineUrl, {
      transports: ["websocket"],
      reconnectionDelayMax: 4000,
    });
    socket.on("connect", () => setConnection("connected"));
    socket.on("disconnect", () => setConnection("disconnected"));
    socket.on("connect_error", () => setConnection("disconnected"));
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
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [machineUrl, live, queryClient, notify]);

  const setMachineUrl = useCallback((url: string | null) => {
    setMachineUrlState(saveMachineUrl(url));
  }, []);

  const value = useMemo(
    () => ({
      machineUrl,
      watcherUrl: watcherUrl(machineUrl),
      api,
      live,
      connection,
      setMachineUrl,
    }),
    [machineUrl, api, live, connection, setMachineUrl],
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

import React, { createContext, useContext, useEffect, useState } from "react";

import type { StatusData } from "@meticulous-home/espresso-api";
import {
  api,
  getIdentityIssue,
  markIdentityRecovered,
  subscribeToIdentityIssue,
} from "../api/api";
import { clearCredential, getStoredCredential } from "../api/pairing";

// Connection lifecycle, surfaced so no screen ever fails silently:
//  connecting   - trying to reach the machine
//  connected    - live
//  unauthorized - the machine refused us (this device is not paired / token
//                 revoked); the user must authorize
//  error        - the machine is unreachable for another reason
export type ConnectionState =
  | "connecting"
  | "connected"
  | "unauthorized"
  | "identity_changed"
  | "error";

interface SocketContextType {
  status: StatusData | null;
  sensors: object | null;
  connection: ConnectionState;
  errorMessage: string | null;
  legacyMachine: boolean;
}

const SocketContext = createContext<SocketContextType>({
  status: null,
  sensors: null,
  connection: "connecting",
  errorMessage: null,
  legacyMachine: false,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useSocketData = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [sensorData, setSensorData] = useState<object | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [legacyMachine, setLegacyMachine] = useState(false);

  useEffect(() => {
    const unsubscribeIdentity = subscribeToIdentityIssue((issue) => {
      if (issue) {
        setConnection("identity_changed");
        setErrorMessage(`Machine identity ${issue.result}.`);
      }
    });

    void api
      .getDeviceInfo()
      .then((response) => {
        const machine = response.data as { identity?: unknown };
        setLegacyMachine(!machine.identity);
      })
      .catch(() => {
        // The socket state below provides the visible connection error.
      });

    api.connectToSocket();
    const newSocket = api.getSocket();
    if (!newSocket) {
      setConnection("error");
      setErrorMessage("Could not create the machine connection.");
      return unsubscribeIdentity;
    }

    newSocket.on("connect", () => {
      markIdentityRecovered();
      setConnection("connected");
      setErrorMessage(null);
    });

    newSocket.on("disconnect", (reason) => {
      // A clean disconnect while we were connected: fall back to connecting so
      // the UI shows a reconnecting state rather than going blank.
      setConnection((prev) => (prev === "connected" ? "connecting" : prev));
      if (reason === "io server disconnect") newSocket.connect();
    });

    newSocket.on("connect_error", (err: Error) => {
      // The machine refuses unauthorized clients at the handshake. Treat a
      // refusal (or the absence of a token) as "needs authorization"; anything
      // else is a genuine connectivity error.
      if (getIdentityIssue()) {
        setConnection("identity_changed");
        return;
      }
      const refused =
        /unauthor/i.test(err?.message || "") || !getStoredCredential();
      if (refused) {
        const rejected = api.getCredential();
        const stored = getStoredCredential();
        if (rejected && stored?.token === rejected.token) clearCredential();
        newSocket.io.reconnection(false);
        api.disconnectSocket();
        setConnection("unauthorized");
      } else {
        setConnection("error");
        setErrorMessage(err?.message || "Could not reach the machine.");
      }
    });

    newSocket.on("status", (data: StatusData) => {
      setStatusData(data);
    });

    newSocket.on("sensors", (data: object) => {
      setSensorData(data);
    });

    return () => {
      unsubscribeIdentity();
      api.disconnectSocket();
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        status: statusData,
        sensors: sensorData,
        connection,
        errorMessage,
        legacyMachine,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

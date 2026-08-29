import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

import type { StatusData } from "@meticulous-home/espresso-api";
import { SERVER_URL } from "../api/api";
import { getStoredToken } from "../api/pairing";

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
  | "error";

interface SocketContextType {
  status: StatusData | null;
  sensors: object | null;
  connection: ConnectionState;
  errorMessage: string | null;
}

const SocketContext = createContext<SocketContextType>({
  status: null,
  sensors: null,
  connection: "connecting",
  errorMessage: null,
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

  useEffect(() => {
    const token = getStoredToken();
    const newSocket = io(SERVER_URL, {
      transports: ["websocket"],
      auth: token ? { token } : {},
    });

    newSocket.on("connect", () => {
      setConnection("connected");
      setErrorMessage(null);
    });

    newSocket.on("disconnect", () => {
      // A clean disconnect while we were connected: fall back to connecting so
      // the UI shows a reconnecting state rather than going blank.
      setConnection((prev) => (prev === "connected" ? "connecting" : prev));
    });

    newSocket.on("connect_error", (err: Error) => {
      // The machine refuses unauthorized clients at the handshake. Treat a
      // refusal (or the absence of a token) as "needs authorization"; anything
      // else is a genuine connectivity error.
      const refused = /unauthor/i.test(err?.message || "") || !token;
      if (refused) {
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
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        status: statusData,
        sensors: sensorData,
        connection,
        errorMessage,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

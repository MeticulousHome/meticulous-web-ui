import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

import type { StatusData } from "@meticulous-home/espresso-api";
import { SERVER_URL } from "../api/api";

interface SocketContextType {
  status: StatusData | null;
  sensors: object | null;
}

const SocketContext = createContext<SocketContextType>({
  status: null,
  sensors: null,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useSocketData = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [sensorData, setSensorData] = useState<object | null>(null);

  useEffect(() => {
    console.log("Connecting to socket at:", SERVER_URL);
    const newSocket = io(SERVER_URL, {
      transports: ["websocket"],
    });

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
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
    <SocketContext.Provider value={{ status: statusData, sensors: sensorData }}>
      {children}
    </SocketContext.Provider>
  );
};

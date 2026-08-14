import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./auth-context";

export interface IncomingChallenge {
  challengeId: string;
  from: { id: string; displayName: string };
  expiresAt: number;
}

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  incomingChallenge: IncomingChallenge | null;
  clearIncomingChallenge: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io({ withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("battle:challengeReceived", (payload: IncomingChallenge) => {
      setIncomingChallenge(payload);
    });

    socket.on("battle:challengeUpdate", (payload: { challengeId: string }) => {
      setIncomingChallenge((cur) => (cur?.challengeId === payload.challengeId ? null : cur));
    });

    socket.on("battle:roomReady", (payload: { roomId: string }) => {
      setIncomingChallenge(null);
      navigate(`/battle/${payload.roomId}`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        incomingChallenge,
        clearIncomingChallenge: () => setIncomingChallenge(null),
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}

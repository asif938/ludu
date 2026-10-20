"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { ClientEvents, ServerEvents } from "@/lib/socket/events";
import type {
  DiceRolledPayload,
  ErrorPayload,
  FinishedPayload,
  RoomUpdatedPayload,
  TokenMovedPayload,
} from "@/lib/socket/events";
import type { GameState } from "@/lib/game/types";
import type { SeatConfigureMode } from "@/lib/rooms/types";
import { loadRoomCredentials } from "@/lib/device/session";

export type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

export interface UseRoomSocketResult {
  connectionState: ConnectionState;
  room: RoomUpdatedPayload | null;
  gameState: GameState | null;
  mySeatIndexes: number[];
  lastDiceRoll: DiceRolledPayload | null;
  lastTokenEvent: TokenMovedPayload | null;
  lastError: ErrorPayload | null;
  lastFinished: FinishedPayload | null;
  start: () => void;
  roll: (seatIndex: number) => void;
  move: (seatIndex: number, tokenId: string, diceValue: number) => void;
  leave: () => void;
  requestState: () => void;
  removePlayer: (targetSeatIndex: number) => void;
  configureSeat: (targetSeatIndex: number, mode: SeatConfigureMode) => void;
  clearError: () => void;
}

export function useRoomSocket(roomId: string): UseRoomSocketResult {
  const socketRef = useRef<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [room, setRoom] = useState<RoomUpdatedPayload | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mySeatIndexes, setMySeatIndexes] = useState<number[]>([]);
  const [lastDiceRoll, setLastDiceRoll] = useState<DiceRolledPayload | null>(null);
  const [lastTokenEvent, setLastTokenEvent] = useState<TokenMovedPayload | null>(null);
  const [lastError, setLastError] = useState<ErrorPayload | null>(null);
  const [lastFinished, setLastFinished] = useState<FinishedPayload | null>(null);

  useEffect(() => {
    const credentials = loadRoomCredentials(roomId);
    if (!credentials || credentials.seats.length === 0) {
      // No stored credentials: nothing to connect to for this room.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConnectionState("disconnected");
      return;
    }

    // About to open the socket.io connection below; mirrors that external state.
    setConnectionState("connecting");
    const socket = io({ path: "/socket.io", withCredentials: true });
    socketRef.current = socket;

    const seatTokens = credentials.seats.map((s) => s.seatToken);
    const seatIndexes = credentials.seats.map((s) => s.seatIndex);
    setMySeatIndexes(seatIndexes);

    function authenticate() {
      socket.emit(ClientEvents.Authenticate, { roomId, seatTokens });
    }

    socket.on("connect", () => {
      setConnectionState("connected");
      authenticate();
    });
    socket.on("disconnect", () => setConnectionState("disconnected"));
    socket.on("connect_error", () => setConnectionState("disconnected"));

    socket.on(ServerEvents.Joined, (payload: { room: { roomVersion: number } }) => {
      void payload;
    });
    socket.on(ServerEvents.Updated, (payload: RoomUpdatedPayload) => setRoom(payload));
    socket.on(ServerEvents.GameStarted, (payload: { state: GameState }) =>
      setGameState(payload.state),
    );
    socket.on(ServerEvents.GameState, (payload: { state: GameState }) =>
      setGameState(payload.state),
    );
    socket.on(ServerEvents.DiceRolled, (payload: DiceRolledPayload) =>
      setLastDiceRoll(payload),
    );
    socket.on(ServerEvents.TokenMoved, (payload: TokenMovedPayload) =>
      setLastTokenEvent(payload),
    );
    socket.on(ServerEvents.Error, (payload: ErrorPayload) => setLastError(payload));
    socket.on(ServerEvents.Finished, (payload: FinishedPayload) =>
      setLastFinished(payload),
    );

    return () => {
      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  const start = useCallback(() => {
    socketRef.current?.emit(ClientEvents.Start, { roomId });
  }, [roomId]);

  const roll = useCallback(
    (seatIndex: number) => {
      socketRef.current?.emit(ClientEvents.Roll, { roomId, seatIndex });
    },
    [roomId],
  );

  const move = useCallback(
    (seatIndex: number, tokenId: string, diceValue: number) => {
      socketRef.current?.emit(ClientEvents.Move, {
        roomId,
        seatIndex,
        tokenId,
        diceValue,
      });
    },
    [roomId],
  );

  const leave = useCallback(() => {
    socketRef.current?.emit(ClientEvents.Leave, { roomId });
  }, [roomId]);

  const requestState = useCallback(() => {
    socketRef.current?.emit(ClientEvents.RequestState, { roomId });
  }, [roomId]);

  const removePlayer = useCallback(
    (targetSeatIndex: number) => {
      socketRef.current?.emit(ClientEvents.RemovePlayer, { roomId, targetSeatIndex });
    },
    [roomId],
  );

  const configureSeat = useCallback(
    (targetSeatIndex: number, mode: SeatConfigureMode) => {
      socketRef.current?.emit(ClientEvents.ConfigureSeat, { roomId, targetSeatIndex, mode });
    },
    [roomId],
  );

  const clearError = useCallback(() => setLastError(null), []);

  return {
    connectionState,
    room,
    gameState,
    mySeatIndexes,
    lastDiceRoll,
    lastTokenEvent,
    lastError,
    lastFinished,
    start,
    roll,
    move,
    leave,
    requestState,
    removePlayer,
    configureSeat,
    clearError,
  };
}

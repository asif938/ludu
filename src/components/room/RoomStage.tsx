"use client";

import { useEffect, useRef } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import { Lobby } from "@/components/lobby/Lobby";
import { GameScreen } from "@/components/board/GameScreen";

export function RoomStage({ roomId }: { roomId: string }) {
  const {
    connectionState,
    room,
    gameState,
    mySeatIndexes,
    lastDiceRoll,
    lastError,
    start,
    roll,
    move,
    leave,
    removePlayer,
    clearError,
  } = useRoomSocket(roomId);

  const wasDisconnected = useRef(false);

  useEffect(() => {
    if (!lastError) return;
    toast.error(lastError.message);
    clearError();
  }, [lastError, clearError]);

  useEffect(() => {
    if (connectionState === "disconnected" && room) {
      wasDisconnected.current = true;
      toast.warning("Connection lost. Trying to reconnect…");
    } else if (connectionState === "connected" && wasDisconnected.current) {
      wasDisconnected.current = false;
      toast.success("Reconnected.");
    }
  }, [connectionState, room]);

  if (connectionState === "idle" || connectionState === "connecting" || !room) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Connecting to room {roomId}…</p>
      </div>
    );
  }

  if (connectionState === "disconnected" && !gameState) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <WifiOff className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Reconnecting to room {roomId}…</p>
      </div>
    );
  }

  if (room.status === "waiting" || !gameState) {
    return <Lobby room={room} mySeatIndexes={mySeatIndexes} onStart={start} onLeave={leave} />;
  }

  return (
    <GameScreen
      room={room}
      gameState={gameState}
      mySeatIndexes={mySeatIndexes}
      lastDiceRoll={lastDiceRoll}
      onRoll={roll}
      onMove={move}
      onRemovePlayer={removePlayer}
    />
  );
}

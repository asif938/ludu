"use client";

import { Bot, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PLAYER_COLOR_STYLES } from "@/lib/ui/playerColors";
import type { GameState } from "@/lib/game/types";
import type { RoomUpdatedPayload } from "@/lib/socket/events";

export function PlayerPanel({
  room,
  gameState,
}: {
  room: RoomUpdatedPayload;
  gameState: GameState;
}) {
  const currentSeat = gameState.turnOrder[gameState.currentTurnIndex];

  return (
    <div className="flex w-full flex-col gap-2">
      {gameState.players.map((player) => {
        const seat = room.seats.find((s) => s.seatIndex === player.seatIndex);
        const style = PLAYER_COLOR_STYLES[player.color];
        const finishedCount = player.tokens.filter((t) => t.status === "finished").length;
        const isCurrent = player.seatIndex === currentSeat && gameState.status === "playing";

        return (
          <div
            key={player.seatIndex}
            className={`flex items-center justify-between rounded-lg border-2 p-2.5 transition-colors ${
              isCurrent ? `${style.border} bg-accent` : "border-transparent"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`size-3 rounded-full ${style.bg} ${isCurrent ? "motion-safe:animate-pulse" : ""}`} />
              <span className="text-sm font-medium">{seat?.displayName ?? `Seat ${player.seatIndex + 1}`}</span>
              {seat?.kind === "local" && (
                <Badge variant="outline" className="text-[10px]">
                  local
                </Badge>
              )}
              {seat?.kind === "bot" && <Bot className="size-3.5 text-muted-foreground" />}
              {seat && seat.kind !== "bot" && !seat.connected && (
                <WifiOff className="size-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {finishedCount}/{player.tokens.length} home
              </span>
              {isCurrent && <Badge className={style.bg}>Turn</Badge>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

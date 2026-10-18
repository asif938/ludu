"use client";

import { Bot, UserX, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PLAYER_COLOR_STYLES } from "@/lib/ui/playerColors";
import type { GameState } from "@/lib/game/types";
import type { RoomUpdatedPayload } from "@/lib/socket/events";

export function PlayerPanel({
  room,
  gameState,
  isHost,
  onRemovePlayer,
}: {
  room: RoomUpdatedPayload;
  gameState: GameState;
  /** Only the host may remove another player; omit onRemovePlayer to hide
   * the control entirely (e.g. in read-only contexts). */
  isHost?: boolean;
  onRemovePlayer?: (seatIndex: number) => void;
}) {
  const currentSeat = gameState.turnOrder[gameState.currentTurnIndex];

  return (
    <div className="flex w-full flex-col gap-2">
      {gameState.players.map((player) => {
        const seat = room.seats.find((s) => s.seatIndex === player.seatIndex);
        const style = PLAYER_COLOR_STYLES[player.color];
        const finishedCount = player.tokens.filter((t) => t.status === "finished").length;
        const isCurrent = player.seatIndex === currentSeat && gameState.status === "playing";
        // The server always authorizes this as the host's own seat acting
        // on another, so the only seat that can never be removed here is
        // the host's own — not every seat the host's device happens to
        // control (a host sharing local seats can still remove those).
        const canRemove =
          isHost &&
          !!onRemovePlayer &&
          gameState.status === "playing" &&
          player.seatIndex !== room.hostSeatIndex;

        return (
          <div
            key={player.seatIndex}
            className={`flex items-center justify-between gap-2 rounded-lg border-2 p-2.5 transition-colors ${
              isCurrent ? `${style.border} bg-accent` : "border-transparent"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className={`size-3 shrink-0 rounded-full ${style.bg} ${isCurrent ? "motion-safe:animate-pulse" : ""}`} />
              <span className="truncate text-sm font-medium">{seat?.displayName ?? `Seat ${player.seatIndex + 1}`}</span>
              {seat?.kind === "local" && (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  local
                </Badge>
              )}
              {seat?.kind === "bot" && <Bot className="size-3.5 shrink-0 text-muted-foreground" />}
              {seat && seat.kind !== "bot" && !seat.connected && (
                <WifiOff className="size-3.5 shrink-0 text-muted-foreground" />
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span>
                {finishedCount}/{player.tokens.length} home
              </span>
              {isCurrent && <Badge className={style.bg}>Turn</Badge>}
              {canRemove && (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${seat?.displayName ?? "player"} from the match`}
                      >
                        <UserX className="size-4" />
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Remove {seat?.displayName ?? "this player"}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Their tokens are taken off the board immediately and
                        they can no longer take turns. This can&apos;t be
                        undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onRemovePlayer?.(player.seatIndex)}>
                        Remove player
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

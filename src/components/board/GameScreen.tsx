"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
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
import { Board } from "./Board";
import { Dice } from "./Dice";
import { PlayerPanel } from "./PlayerPanel";
import { GameOverDialog } from "./GameOverDialog";
import type { GameState } from "@/lib/game/types";
import type { DiceRolledPayload, RoomUpdatedPayload } from "@/lib/socket/events";

export function GameScreen({
  room,
  gameState,
  mySeatIndexes,
  lastDiceRoll,
  onRoll,
  onMove,
}: {
  room: RoomUpdatedPayload;
  gameState: GameState;
  mySeatIndexes: number[];
  lastDiceRoll: DiceRolledPayload | null;
  onRoll: (seatIndex: number) => void;
  onMove: (seatIndex: number, tokenId: string, diceValue: number) => void;
}) {
  const router = useRouter();
  const [gameOverOpen, setGameOverOpen] = useState(false);

  const currentSeat = gameState.turnOrder[gameState.currentTurnIndex];
  const isMyTurn = mySeatIndexes.includes(currentSeat);
  const canRoll = isMyTurn && gameState.pendingRoll === null && gameState.status === "playing";

  const legalTokenIds = useMemo(() => {
    if (gameState.pendingRoll === null) return [];
    if (!lastDiceRoll || lastDiceRoll.roll !== gameState.pendingRoll) return [];
    if (lastDiceRoll.seatIndex !== currentSeat) return [];
    return lastDiceRoll.legalTokenIds;
  }, [gameState.pendingRoll, lastDiceRoll, currentSeat]);

  const myTokenIds = useMemo(() => {
    if (!isMyTurn) return new Set<string>();
    const player = gameState.players.find((p) => p.seatIndex === currentSeat);
    return new Set(player?.tokens.map((t) => t.id) ?? []);
  }, [isMyTurn, gameState.players, currentSeat]);

  useEffect(() => {
    if (gameState.status !== "finished") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGameOverOpen(true);
  }, [gameState.status]);

  useEffect(() => {
    const event = gameState.lastEvent;
    if (!event) return;
    if (event.type === "captured") {
      toast.info("A token was captured and sent back home!");
    } else if (event.type === "turn-skipped") {
      toast.message("No legal moves — turn skipped.");
    }
  }, [gameState.lastEvent]);

  function handleRoll() {
    onRoll(currentSeat);
  }

  function handleTokenClick(tokenId: string) {
    if (gameState.pendingRoll === null) return;
    onMove(currentSeat, tokenId, gameState.pendingRoll);
  }

  const winnerSeat =
    gameState.winnerSeatIndex !== null
      ? room.seats.find((s) => s.seatIndex === gameState.winnerSeatIndex)
      : null;
  const winnerColor =
    gameState.winnerSeatIndex !== null
      ? gameState.players.find((p) => p.seatIndex === gameState.winnerSeatIndex)?.color ?? null
      : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col items-center gap-4">
        <Board
          gameState={gameState}
          legalTokenIds={legalTokenIds}
          myTokenIds={myTokenIds}
          onTokenClick={handleTokenClick}
        />
        <Dice
          value={gameState.pendingRoll ?? gameState.lastRoll}
          rollNonce={gameState.version}
          canRoll={canRoll}
          onRoll={handleRoll}
        />
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {gameState.status === "finished"
            ? "Match finished."
            : isMyTurn
              ? gameState.pendingRoll === null
                ? "Your turn — roll the dice."
                : "Pick a highlighted token to move."
              : `Waiting for ${room.seats.find((s) => s.seatIndex === currentSeat)?.displayName ?? "the other player"}…`}
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 lg:w-72">
        <PlayerPanel room={room} gameState={gameState} />
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="outline" size="sm">
                <LogOut className="size-4" />
                Leave match
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave this match?</AlertDialogTitle>
              <AlertDialogDescription>
                The match keeps going without you. Your seat will show as
                disconnected, and you can rejoin from this device while the
                match is still active.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay</AlertDialogCancel>
              <AlertDialogAction onClick={() => router.push("/")}>
                Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <GameOverDialog
        open={gameOverOpen}
        onOpenChange={setGameOverOpen}
        winnerName={winnerSeat?.displayName ?? null}
        winnerColor={winnerColor}
        isMyWin={gameState.winnerSeatIndex !== null && mySeatIndexes.includes(gameState.winnerSeatIndex)}
      />
    </div>
  );
}

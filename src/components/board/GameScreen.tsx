"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { Board } from "./Board";
import { Dice } from "./Dice";
import { PlayerPanel } from "./PlayerPanel";
import { LeaveMatchButton } from "./LeaveMatchButton";
import { MobileMatchMenu } from "./MobileMatchMenu";
import { GameOverDialog } from "./GameOverDialog";
import type { GameState } from "@/lib/game/types";
import type { DiceRolledPayload, RoomUpdatedPayload } from "@/lib/socket/events";
import { diceAnchorForColor } from "@/lib/ui/boardLayout";
import { PLAYER_COLOR_STYLES } from "@/lib/ui/playerColors";

export function GameScreen({
  room,
  gameState,
  mySeatIndexes,
  lastDiceRoll,
  onRoll,
  onMove,
  onRemovePlayer,
}: {
  room: RoomUpdatedPayload;
  gameState: GameState;
  mySeatIndexes: number[];
  lastDiceRoll: DiceRolledPayload | null;
  onRoll: (seatIndex: number) => void;
  onMove: (seatIndex: number, tokenId: string, diceValue: number) => void;
  onRemovePlayer: (seatIndex: number) => void;
}) {
  const [gameOverOpen, setGameOverOpen] = useState(false);

  const isHost = mySeatIndexes.includes(room.hostSeatIndex);
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
    } else if (event.type === "player-removed") {
      const name = room.seats.find((s) => s.seatIndex === event.seatIndex)?.displayName ?? "A player";
      toast.message(`${name} was removed from the match.`);
    }
  }, [gameState.lastEvent, room.seats]);

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

  const currentPlayer = gameState.players.find((p) => p.seatIndex === currentSeat);
  const currentColor = currentPlayer?.color ?? "red";
  const currentStyle = PLAYER_COLOR_STYLES[currentColor];
  const currentName = room.seats.find((s) => s.seatIndex === currentSeat)?.displayName ?? "the other player";
  const diceAnchor = diceAnchorForColor(currentColor);
  const diceBoxClass = `items-center justify-center rounded-xl border-2 bg-card p-2 shadow-sm transition-colors ${currentStyle.border}`;

  // Outside the board's own box (above/below, left/right-aligned with the
  // active color's corner), not inside its flow — so the board's own
  // position never shifts as this moves turn to turn.
  const mobileDiceStyle: CSSProperties = {
    ...(diceAnchor.vertical === "above" ? { bottom: "100%", marginBottom: 8 } : { top: "100%", marginTop: 8 }),
    ...(diceAnchor.horizontal === "right" ? { right: 0 } : { left: 0 }),
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 pb-20 lg:max-w-7xl lg:flex-row lg:items-start lg:gap-8 lg:pb-4">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 lg:justify-start">
        {gameState.status === "playing" && (
          <div
            className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${currentStyle.border} ${currentStyle.text}`}
          >
            <span className={`size-2.5 rounded-full ${currentStyle.bg} motion-safe:animate-pulse`} />
            {isMyTurn ? "Your turn!" : `${currentName}'s turn`}
          </div>
        )}

        <div className="relative flex w-full max-w-[min(90vw,640px)] items-center lg:max-w-none lg:flex-1 lg:gap-4">
          {gameState.status === "playing" && (
            <div className="absolute lg:hidden" style={mobileDiceStyle}>
              <div className={`flex ${diceBoxClass}`}>
                <Dice
                  value={gameState.pendingRoll ?? gameState.lastRoll}
                  rollNonce={gameState.version}
                  canRoll={canRoll}
                  onRoll={handleRoll}
                  compact
                />
              </div>
            </div>
          )}

          <Board
            gameState={gameState}
            legalTokenIds={legalTokenIds}
            myTokenIds={myTokenIds}
            onTokenClick={handleTokenClick}
          />

          {gameState.status === "playing" && (
            <div className={`hidden shrink-0 lg:flex ${diceBoxClass}`}>
              <Dice
                value={gameState.pendingRoll ?? gameState.lastRoll}
                rollNonce={gameState.version}
                canRoll={canRoll}
                onRoll={handleRoll}
              />
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {gameState.status === "finished"
            ? "Match finished."
            : isMyTurn
              ? gameState.pendingRoll === null
                ? "Roll the dice."
                : "Pick a highlighted token to move."
              : `Waiting for ${currentName}…`}
        </p>
      </div>

      <div className="hidden w-full shrink-0 flex-col gap-3 lg:flex lg:w-80">
        <PlayerPanel room={room} gameState={gameState} isHost={isHost} onRemovePlayer={onRemovePlayer} />
        <LeaveMatchButton />
      </div>

      <MobileMatchMenu room={room} gameState={gameState} isHost={isHost} onRemovePlayer={onRemovePlayer} />

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

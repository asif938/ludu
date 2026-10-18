import { randomInt } from "node:crypto";
import {
  absoluteCellForProgress,
  colorForSeat,
  FINISH_PROGRESS,
  isSafeCell,
  LAST_MAIN_PATH_PROGRESS,
  TOKENS_PER_PLAYER,
} from "./config";
import {
  GameEvent,
  GameState,
  IllegalActionError,
  LegalMove,
  PlayerState,
  SeatIndex,
  TokenState,
} from "./types";

/** Secure, server-side dice roll. Never trust a client-supplied roll. */
export function rollDiceValue(): number {
  return randomInt(1, 7); // 1-6 inclusive
}

export function createInitialGameState(
  seatIndexes: SeatIndex[],
  tokensPerPlayer: number = TOKENS_PER_PLAYER,
): GameState {
  if (seatIndexes.length < 2 || seatIndexes.length > 4) {
    throw new IllegalActionError("A game requires between 2 and 4 seats.");
  }
  const turnOrder = [...seatIndexes].sort((a, b) => a - b);
  const players: PlayerState[] = turnOrder.map((seatIndex) => {
    const color = colorForSeat(seatIndex);
    const tokens: TokenState[] = Array.from(
      { length: tokensPerPlayer },
      (_, i) => ({
        id: `${color}-${i}`,
        color,
        status: "yard" as const,
      }),
    );
    return { seatIndex, color, tokens };
  });

  return {
    version: 1,
    status: "playing",
    players,
    turnOrder,
    currentTurnIndex: 0,
    pendingRoll: null,
    consecutiveSixes: 0,
    winnerSeatIndex: null,
    lastRoll: null,
    lastEvent: null,
  };
}

function currentSeat(state: GameState): SeatIndex {
  return state.turnOrder[state.currentTurnIndex];
}

function getPlayer(state: GameState, seatIndex: number): PlayerState {
  const player = state.players.find((p) => p.seatIndex === seatIndex);
  if (!player) throw new IllegalActionError(`No player at seat ${seatIndex}`);
  return player;
}

/** Pure: compute every legal move for the acting seat given a dice value. */
export function getLegalMoves(
  state: GameState,
  seatIndex: number,
  diceValue: number,
): LegalMove[] {
  if (state.status !== "playing") return [];
  if (currentSeat(state) !== seatIndex) return [];

  const player = getPlayer(state, seatIndex);
  const moves: LegalMove[] = [];

  for (const token of player.tokens) {
    if (token.status === "finished") continue;

    if (token.status === "yard") {
      if (diceValue === 6) {
        moves.push({ tokenId: token.id, kind: "release", toProgress: 0 });
      }
      continue;
    }

    // active
    const progress = token.progress ?? 0;
    const toProgress = progress + diceValue;
    if (toProgress <= FINISH_PROGRESS) {
      moves.push({ tokenId: token.id, kind: "advance", toProgress });
    }
  }

  return moves;
}

export interface RollOutcome {
  state: GameState;
  legalMoves: LegalMove[];
  autoSkipped: boolean;
}

/** Pure given diceValue: records the roll and either exposes legal moves
 * or auto-skips the turn when none exist. */
export function startTurnRoll(
  state: GameState,
  seatIndex: number,
  diceValue: number,
): RollOutcome {
  if (state.status !== "playing") {
    throw new IllegalActionError("Game has already finished.");
  }
  if (currentSeat(state) !== seatIndex) {
    throw new IllegalActionError("It is not this seat's turn.");
  }
  if (state.pendingRoll !== null) {
    throw new IllegalActionError("Current roll must be resolved first.");
  }
  if (diceValue < 1 || diceValue > 6) {
    throw new IllegalActionError("Dice value out of range.");
  }

  const legalMoves = getLegalMoves(state, seatIndex, diceValue);

  let next: GameState = {
    ...state,
    version: state.version + 1,
    lastRoll: diceValue,
  };

  if (legalMoves.length === 0) {
    next = advanceTurn(next, diceValue === 6);
    next.lastEvent = { type: "turn-skipped", seatIndex: seatIndex as SeatIndex };
    return { state: next, legalMoves, autoSkipped: true };
  }

  next.pendingRoll = diceValue;
  next.consecutiveSixes = diceValue === 6 ? state.consecutiveSixes + 1 : 0;
  return { state: next, legalMoves, autoSkipped: false };
}

export interface MoveOutcome {
  state: GameState;
  events: GameEvent[];
}

/** Applies a validated move. Recomputes legality server-side rather than
 * trusting the client's claim that a move is legal. */
export function applyMove(
  state: GameState,
  seatIndex: number,
  tokenId: string,
  diceValue: number,
): MoveOutcome {
  if (state.status !== "playing") {
    throw new IllegalActionError("Game has already finished.");
  }
  if (currentSeat(state) !== seatIndex) {
    throw new IllegalActionError("It is not this seat's turn.");
  }
  if (state.pendingRoll !== diceValue) {
    throw new IllegalActionError("Dice value does not match the pending roll.");
  }

  const legalMoves = getLegalMoves(state, seatIndex, diceValue);
  const move = legalMoves.find((m) => m.tokenId === tokenId);
  if (!move) {
    throw new IllegalActionError("That token cannot make this move.");
  }

  const player = getPlayer(state, seatIndex);
  const events: GameEvent[] = [];

  const players = state.players.map((p) =>
    p.seatIndex === player.seatIndex ? clonePlayer(p) : p,
  );
  const activePlayer = players.find((p) => p.seatIndex === player.seatIndex)!;
  const token = activePlayer.tokens.find((t) => t.id === tokenId)!;

  if (move.kind === "release") {
    token.status = "active";
    token.progress = 0;
    events.push({ type: "released", seatIndex: seatIndex as SeatIndex, tokenId });
  } else {
    const from = token.progress ?? 0;
    token.progress = move.toProgress;
    if (move.toProgress === FINISH_PROGRESS) {
      token.status = "finished";
    }
    events.push({
      type: "moved",
      seatIndex: seatIndex as SeatIndex,
      tokenId,
      from,
      to: move.toProgress,
    });
  }

  // Capture check (only possible on the shared track, not in home stretches).
  if (token.status === "active" && token.progress !== undefined) {
    const cell = absoluteCellForProgress(token.color, token.progress);
    if (cell !== null && !isSafeCell(cell)) {
      const capturedTokenIds: string[] = [];
      for (const other of players) {
        if (other.seatIndex === activePlayer.seatIndex) continue;
        for (const otherToken of other.tokens) {
          if (
            otherToken.status === "active" &&
            otherToken.progress !== undefined &&
            otherToken.progress <= LAST_MAIN_PATH_PROGRESS &&
            absoluteCellForProgress(otherToken.color, otherToken.progress) ===
              cell
          ) {
            otherToken.status = "yard";
            otherToken.progress = undefined;
            capturedTokenIds.push(otherToken.id);
          }
        }
      }
      if (capturedTokenIds.length > 0) {
        events.push({
          type: "captured",
          seatIndex: seatIndex as SeatIndex,
          tokenId,
          capturedTokenIds,
        });
      }
    }
  }

  if (token.status === "finished") {
    events.push({
      type: "finished-token",
      seatIndex: seatIndex as SeatIndex,
      tokenId,
    });
  }

  const wonMatch = activePlayer.tokens.every((t) => t.status === "finished");

  let next: GameState = {
    ...state,
    version: state.version + 1,
    players,
    pendingRoll: null,
  };

  if (wonMatch) {
    next.status = "finished";
    next.winnerSeatIndex = activePlayer.seatIndex;
    events.push({ type: "won", seatIndex: activePlayer.seatIndex });
  } else {
    next = advanceTurn(next, diceValue === 6);
  }

  next.lastEvent = events[events.length - 1] ?? null;
  return { state: next, events };
}

/** Advances currentTurnIndex unless the player earned an extra roll (six). */
function advanceTurn(state: GameState, grantExtraRoll: boolean): GameState {
  if (grantExtraRoll) {
    return { ...state, pendingRoll: null };
  }
  return {
    ...state,
    pendingRoll: null,
    consecutiveSixes: 0,
    currentTurnIndex: (state.currentTurnIndex + 1) % state.turnOrder.length,
  };
}

function clonePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
    tokens: player.tokens.map((t) => ({ ...t })),
  };
}

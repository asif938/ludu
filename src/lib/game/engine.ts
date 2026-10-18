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

/** How many of a player's own turns the yard-stuck pity timer spans. */
const SIX_PITY_WINDOW = 5;

function allTokensInYard(player: PlayerState): boolean {
  return player.tokens.every((t) => t.status === "yard");
}

export interface DiceRollPrep {
  state: GameState;
  /** Non-null when this roll must come up 6 to satisfy the pity rule. */
  forcedValue: number | null;
}

/**
 * Tracks, per seat, a "pity" guarantee: once a player has every token stuck
 * in the yard, they are guaranteed a 6 on one randomly chosen turn within
 * their next 5 turns (never always the first, never a fixed count-down).
 * Other turns for that seat roll normally, and other seats are untouched.
 *
 * Call this before generating the actual dice value, then use
 * `forcedValue` in place of a random roll when it is non-null.
 */
export function prepareDiceRoll(state: GameState, seatIndex: number): DiceRollPrep {
  const player = state.players.find((p) => p.seatIndex === seatIndex);
  if (!player) return { state, forcedValue: null };

  if (!allTokensInYard(player)) {
    if (!player.sixPity) return { state, forcedValue: null };
    return { state: withPity(state, seatIndex, null), forcedValue: null };
  }

  const pity = player.sixPity ?? {
    targetTurn: randomInt(1, SIX_PITY_WINDOW + 1), // 1..5 inclusive
    turnsElapsed: 0,
  };
  const turnsElapsed = pity.turnsElapsed + 1;

  if (turnsElapsed >= pity.targetTurn) {
    return { state: withPity(state, seatIndex, null), forcedValue: 6 };
  }
  return { state: withPity(state, seatIndex, { ...pity, turnsElapsed }), forcedValue: null };
}

function withPity(
  state: GameState,
  seatIndex: number,
  sixPity: { targetTurn: number; turnsElapsed: number } | null,
): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.seatIndex === seatIndex ? { ...p, sixPity } : p,
    ),
  };
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

export interface RemovePlayerOutcome {
  state: GameState;
  events: GameEvent[];
}

/**
 * Strips a seat out of an in-progress game: its player entry (and every
 * token with it) is removed, and turn order/currentTurnIndex are
 * recomputed so the game keeps running. If only one player is left, they
 * win immediately rather than being left to "play" alone.
 */
export function removePlayer(state: GameState, seatIndex: number): RemovePlayerOutcome {
  if (state.status !== "playing") {
    throw new IllegalActionError("Game is not in progress.");
  }
  if (!state.players.some((p) => p.seatIndex === seatIndex)) {
    throw new IllegalActionError(`No player at seat ${seatIndex}`);
  }

  const wasCurrentTurn = currentSeat(state) === seatIndex;
  const players = state.players.filter((p) => p.seatIndex !== seatIndex);
  const turnOrder = state.turnOrder.filter((s) => s !== seatIndex);
  const events: GameEvent[] = [
    { type: "player-removed", seatIndex: seatIndex as SeatIndex },
  ];

  if (players.length === 1) {
    const winner = players[0];
    const next: GameState = {
      ...state,
      version: state.version + 1,
      players,
      turnOrder,
      currentTurnIndex: 0,
      pendingRoll: null,
      consecutiveSixes: 0,
      status: "finished",
      winnerSeatIndex: winner.seatIndex,
    };
    events.push({ type: "won", seatIndex: winner.seatIndex });
    next.lastEvent = events[events.length - 1];
    return { state: next, events };
  }

  // Recompute currentTurnIndex against the shrunken turnOrder: if the
  // removed seat held the turn, advance to whoever was next in the
  // original rotation; otherwise keep pointing at the same seat.
  const targetSeat = wasCurrentTurn
    ? state.turnOrder[(state.turnOrder.indexOf(seatIndex as SeatIndex) + 1) % state.turnOrder.length]
    : currentSeat(state);
  const currentTurnIndex = turnOrder.indexOf(targetSeat);

  const next: GameState = {
    ...state,
    version: state.version + 1,
    players,
    turnOrder,
    currentTurnIndex,
    pendingRoll: wasCurrentTurn ? null : state.pendingRoll,
    consecutiveSixes: wasCurrentTurn ? 0 : state.consecutiveSixes,
  };
  next.lastEvent = events[events.length - 1];
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

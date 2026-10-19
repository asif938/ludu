/**
 * Core types for the Ludo game engine. This module has zero dependencies on
 * React, Next.js, Socket.IO, or Mongo — it is pure game logic.
 */

export type PlayerColor = "red" | "green" | "yellow" | "blue";

/** Seat index 0-3 maps 1:1 to a color via COLOR_ORDER in config.ts. */
export type SeatIndex = 0 | 1 | 2 | 3;

export type TokenStatus = "yard" | "active" | "finished";

export interface TokenState {
  /** Stable id, e.g. "red-0" .. "red-3". */
  id: string;
  color: PlayerColor;
  status: TokenStatus;
  /**
   * Progress along this token's own path, 0-56 (see config.ts for the
   * exact mapping). Undefined while the token is in the yard.
   */
  progress?: number;
}

export interface PlayerState {
  seatIndex: SeatIndex;
  color: PlayerColor;
  tokens: TokenState[];
  /**
   * Pity timer helping the player release their *next* yard token. `stage`
   * is the number of tokens already released when the timer was started
   * (0 = waiting on the 1st token, 1 = waiting on the 2nd, ...); the timer
   * restarts from scratch whenever the current released count no longer
   * matches `stage` (a token left the yard, or one was captured back into
   * it). See `pityWindowFor` in engine.ts for the per-stage turn windows.
   */
  sixPity?: { stage: number; targetTurn: number; turnsElapsed: number } | null;
  /**
   * Bookkeeping for the anti-streak "1" rules (consecutive-roll cap and
   * five-turn cooldown). Always maintained from the actual roll history,
   * independently of whether either rule is currently enabled, so toggling
   * a rule mid-match reacts to real history rather than a blank slate.
   */
  oneGuard?: { consecutiveOnes: number; cooldownRemaining: number } | null;
}

export type GameStatus = "playing" | "finished";

export interface GameState {
  /** Monotonically increasing version, bumped on every authoritative change. */
  version: number;
  status: GameStatus;
  players: PlayerState[];
  /** Fixed turn order of seat indexes, decided once at game start. */
  turnOrder: SeatIndex[];
  currentTurnIndex: number;
  /** Dice value awaiting resolution via a move, or null if a roll is needed. */
  pendingRoll: number | null;
  /** How many consecutive sixes the current player has rolled this turn-chain. */
  consecutiveSixes: number;
  winnerSeatIndex: SeatIndex | null;
  lastRoll: number | null;
  lastEvent: GameEvent | null;
}

export type GameEvent =
  | { type: "released"; seatIndex: SeatIndex; tokenId: string }
  | {
      type: "moved";
      seatIndex: SeatIndex;
      tokenId: string;
      from: number;
      to: number;
    }
  | {
      type: "captured";
      seatIndex: SeatIndex;
      tokenId: string;
      capturedTokenIds: string[];
    }
  | { type: "finished-token"; seatIndex: SeatIndex; tokenId: string }
  | { type: "turn-skipped"; seatIndex: SeatIndex }
  | { type: "player-removed"; seatIndex: SeatIndex }
  | { type: "won"; seatIndex: SeatIndex };

export interface LegalMove {
  tokenId: string;
  kind: "release" | "advance";
  toProgress: number;
}

export class IllegalActionError extends Error {}

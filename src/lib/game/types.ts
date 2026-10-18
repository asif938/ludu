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
   * Pity timer guaranteeing a 6 within 5 turns of having every token stuck
   * in the yard. Set the first time that condition is observed and cleared
   * as soon as it no longer holds (a token leaves the yard, by any means).
   */
  sixPity?: { targetTurn: number; turnsElapsed: number } | null;
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

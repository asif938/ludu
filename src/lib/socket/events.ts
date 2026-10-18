import type { GameEvent, GameState } from "@/lib/game/types";
import type { PublicSeat } from "@/lib/rooms/types";

/** Shared Socket.IO event name constants + payload types, used by both the
 * server (server/socket) and the client (src/hooks). Keeping these in one
 * file prevents client/server event-name drift. */

export const ClientEvents = {
  Authenticate: "room:join",
  Reconnect: "player:reconnect",
  Leave: "room:leave",
  Start: "room:start",
  Roll: "game:roll",
  Move: "game:move",
  RequestState: "game:request-state",
} as const;

export const ServerEvents = {
  Joined: "room:joined",
  Updated: "room:updated",
  Error: "room:error",
  GameStarted: "game:started",
  GameState: "game:state",
  DiceRolled: "game:dice-rolled",
  TokenMoved: "game:token-moved",
  TurnChanged: "game:turn-changed",
  PlayerDisconnected: "game:player-disconnected",
  PlayerReconnected: "game:player-reconnected",
  Finished: "game:finished",
} as const;

export interface AuthenticatePayload {
  roomId: string;
  seatTokens: string[];
}

export interface RollPayload {
  roomId: string;
  seatIndex: number;
}

export interface MovePayload {
  roomId: string;
  seatIndex: number;
  tokenId: string;
  diceValue: number;
}

export interface RoomUpdatedPayload {
  roomId: string;
  status: "waiting" | "playing" | "finished";
  hostSeatIndex: number;
  seats: PublicSeat[];
  roomVersion: number;
  roomSize: 2 | 3 | 4;
  quickMode: boolean;
}

export interface GameStatePayload {
  roomId: string;
  state: GameState;
}

export interface DiceRolledPayload {
  roomId: string;
  seatIndex: number;
  roll: number;
  legalTokenIds: string[];
}

export interface TokenMovedPayload {
  roomId: string;
  seatIndex: number;
  tokenId: string;
  event: GameEvent;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface FinishedPayload {
  roomId: string;
  winnerSeatIndex: number;
}

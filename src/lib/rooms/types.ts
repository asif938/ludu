import type { GameState, PlayerColor } from "@/lib/game/types";

export type RoomStatus = "waiting" | "playing" | "finished";
export type SeatKind = "local" | "remote" | "bot";
/** How many of the 4 physical seats are in play for this match. A 2-seat
 * room uses the diagonal pair (0, 2) so two players sit opposite each
 * other, matching how a real board is played 1v1. See SEAT_LAYOUTS. */
export type RoomSize = 2 | 3 | 4;

export interface SeatRecord {
  seatIndex: number;
  color: PlayerColor;
  occupied: boolean;
  displayName: string | null;
  kind: SeatKind | null;
  deviceGroupId: string | null;
  seatTokenHash: string | null;
  isHost: boolean;
  connected: boolean;
  lastSeenAt: Date | null;
}

export interface RoomRecord {
  roomId: string;
  status: RoomStatus;
  hostDeviceGroupId: string;
  seats: SeatRecord[];
  roomSize: RoomSize;
  quickMode: boolean;
  roomVersion: number;
  gameState: GameState | null;
  gameStateVersion: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

/** Seat shape safe to send to clients — never includes seatTokenHash. */
export interface PublicSeat {
  seatIndex: number;
  color: PlayerColor;
  occupied: boolean;
  displayName: string | null;
  kind: SeatKind | null;
  isHost: boolean;
  connected: boolean;
}

export interface PublicRoom {
  roomId: string;
  status: RoomStatus;
  roomVersion: number;
  roomSize: RoomSize;
  quickMode: boolean;
  seats: PublicSeat[];
  occupiedCount: number;
  canJoin: boolean;
}

export interface SeatCredential {
  seatIndex: number;
  seatToken: string;
}

export interface JoinResult {
  room: PublicRoom;
  deviceGroupId: string;
  credentials: SeatCredential[];
}

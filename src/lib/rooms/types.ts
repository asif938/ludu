import type { GameState, PlayerColor } from "@/lib/game/types";

export type RoomStatus = "waiting" | "playing" | "finished";
export type SeatKind = "local" | "remote";

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

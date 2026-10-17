import { connectToDatabase, isPersistenceConfigured } from "@/lib/db/mongodb";
import { RoomModel } from "@/lib/db/models/Room";
import { GameHistoryModel } from "@/lib/db/models/GameHistory";
import type { RoomRecord, SeatRecord } from "./types";
import type { GameState } from "@/lib/game/types";

/** Mirrors the in-memory room into MongoDB. No-op if MONGODB_URI is unset. */
export async function persistRoom(record: RoomRecord): Promise<void> {
  if (!isPersistenceConfigured()) return;
  await connectToDatabase();
  await RoomModel.findOneAndUpdate(
    { roomId: record.roomId },
    {
      roomId: record.roomId,
      status: record.status,
      hostDeviceGroupId: record.hostDeviceGroupId,
      seats: record.seats,
      roomVersion: record.roomVersion,
      gameState: record.gameState,
      gameStateVersion: record.gameStateVersion,
      expiresAt: record.expiresAt,
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

export async function loadRoomFromDb(roomId: string): Promise<RoomRecord | null> {
  if (!isPersistenceConfigured()) return null;
  await connectToDatabase();
  const doc = await RoomModel.findOne({ roomId }).lean();
  if (!doc) return null;

  const seats: SeatRecord[] = doc.seats.map((s) => ({
    seatIndex: s.seatIndex,
    color: s.color as SeatRecord["color"],
    occupied: s.occupied,
    displayName: s.displayName ?? null,
    kind: (s.kind as SeatRecord["kind"]) ?? null,
    deviceGroupId: s.deviceGroupId ?? null,
    seatTokenHash: s.seatTokenHash ?? null,
    isHost: s.isHost ?? false,
    connected: s.connected ?? false,
    lastSeenAt: s.lastSeenAt ?? null,
  }));

  return {
    roomId: doc.roomId,
    status: doc.status as RoomRecord["status"],
    hostDeviceGroupId: doc.hostDeviceGroupId,
    seats,
    roomVersion: doc.roomVersion,
    gameState: (doc.gameState as GameState | null) ?? null,
    gameStateVersion: doc.gameStateVersion ?? 0,
    createdAt: doc.createdAt ?? new Date(),
    updatedAt: doc.updatedAt ?? new Date(),
    expiresAt: doc.expiresAt,
  };
}

export async function recordGameHistory(input: {
  roomId: string;
  players: { seatIndex: number; displayName: string; color: string }[];
  startedAt: Date;
  finishedAt: Date;
  winnerSeatIndex: number | null;
  resultSummary: string;
  moveLog?: unknown;
}): Promise<void> {
  if (!isPersistenceConfigured()) return;
  await connectToDatabase();
  await GameHistoryModel.create(input);
}

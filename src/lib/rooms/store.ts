import type { RoomRecord } from "./types";

/**
 * Single in-memory source of truth for active rooms, shared by the REST
 * route handlers and the Socket.IO server because both run inside the same
 * Node process (see server/index.ts). MongoDB is a persistence mirror of
 * this store, not the other way around — see lib/db/mongodb.ts.
 *
 * Limitation (documented): this only works for a single server instance.
 * Running multiple instances behind a load balancer would require a shared
 * store (e.g. Redis) and the matching Socket.IO adapter; out of scope here.
 */

declare global {
  var __ludoRoomStore: Map<string, RoomRecord> | undefined;
}

export const roomStore: Map<string, RoomRecord> =
  globalThis.__ludoRoomStore ?? new Map();
globalThis.__ludoRoomStore = roomStore;

export function sweepExpiredRooms(now: Date = new Date()): string[] {
  const removed: string[] = [];
  for (const [roomId, room] of roomStore) {
    if (room.expiresAt.getTime() <= now.getTime()) {
      roomStore.delete(roomId);
      removed.push(roomId);
    }
  }
  return removed;
}

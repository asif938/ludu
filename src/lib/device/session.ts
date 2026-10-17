/**
 * Client-side storage for seat credentials. A device holds one raw seat
 * token per seat it controls (1-3 for a local group, exactly 1 for a lone
 * remote player) — these tokens are the *only* thing that authorizes game
 * actions for that seat, so they never touch application state that could
 * be inspected by another device, only this browser's localStorage.
 */

export interface StoredSeatCredential {
  seatIndex: number;
  seatToken: string;
}

export interface StoredRoomCredentials {
  deviceGroupId: string;
  seats: StoredSeatCredential[];
}

function storageKey(roomId: string): string {
  return `ludo-connect:room:${roomId}`;
}

export function saveRoomCredentials(
  roomId: string,
  data: StoredRoomCredentials,
): void {
  try {
    window.localStorage.setItem(storageKey(roomId), JSON.stringify(data));
  } catch {
    // Private browsing / storage disabled — the session just won't survive
    // a refresh. Non-fatal.
  }
}

export function loadRoomCredentials(roomId: string): StoredRoomCredentials | null {
  try {
    const raw = window.localStorage.getItem(storageKey(roomId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredRoomCredentials;
  } catch {
    return null;
  }
}

export function mergeSeatCredential(
  roomId: string,
  deviceGroupId: string,
  seat: StoredSeatCredential,
): StoredRoomCredentials {
  const existing = loadRoomCredentials(roomId);
  const seats =
    existing && existing.deviceGroupId === deviceGroupId
      ? [...existing.seats.filter((s) => s.seatIndex !== seat.seatIndex), seat]
      : [seat];
  const merged: StoredRoomCredentials = { deviceGroupId, seats };
  saveRoomCredentials(roomId, merged);
  return merged;
}

export function clearRoomCredentials(roomId: string): void {
  try {
    window.localStorage.removeItem(storageKey(roomId));
  } catch {
    // ignore
  }
}

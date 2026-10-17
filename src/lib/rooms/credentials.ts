import { randomBytes, createHash } from "node:crypto";
import { customAlphabet } from "nanoid";

/** Unambiguous alphabet (no 0/O/1/I) for room IDs people type or read aloud. */
const ROOM_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const generateRoomId = customAlphabet(ROOM_ID_ALPHABET, 8);

export function createRoomId(): string {
  return generateRoomId();
}

/** Raw seat credential: issued once to the client, never stored in plaintext. */
export function createSeatToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSeatToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createDeviceGroupId(): string {
  return randomBytes(16).toString("base64url");
}

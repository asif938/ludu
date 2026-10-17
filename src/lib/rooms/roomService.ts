import { COLOR_ORDER } from "@/lib/game/config";
import {
  applyMove,
  createInitialGameState,
  rollDiceValue,
  startTurnRoll,
} from "@/lib/game/engine";
import type { GameEvent, SeatIndex } from "@/lib/game/types";
import { roomMutex } from "@/lib/concurrency/keyedMutex";
import {
  createDeviceGroupId,
  createRoomId,
  createSeatToken,
  hashSeatToken,
} from "./credentials";
import { RoomServiceError } from "./errors";
import { loadRoomFromDb, persistRoom, recordGameHistory } from "./persistence";
import { roomStore } from "./store";
import type {
  JoinResult,
  PublicRoom,
  PublicSeat,
  RoomRecord,
  SeatCredential,
  SeatRecord,
} from "./types";

const TOTAL_SEATS = 4;
const WAITING_TTL_MS = 2 * 60 * 60 * 1000;
const PLAYING_TTL_MS = 12 * 60 * 60 * 1000;
const FINISHED_TTL_MS = 60 * 60 * 1000;

function emptySeats(): SeatRecord[] {
  return Array.from({ length: TOTAL_SEATS }, (_, seatIndex) => ({
    seatIndex,
    color: COLOR_ORDER[seatIndex],
    occupied: false,
    displayName: null,
    kind: null,
    deviceGroupId: null,
    seatTokenHash: null,
    isHost: false,
    connected: false,
    lastSeenAt: null,
  }));
}

export function toPublicSeat(seat: SeatRecord): PublicSeat {
  return {
    seatIndex: seat.seatIndex,
    color: seat.color,
    occupied: seat.occupied,
    displayName: seat.displayName,
    kind: seat.kind,
    isHost: seat.isHost,
    connected: seat.connected,
  };
}

export function toPublicRoom(record: RoomRecord): PublicRoom {
  const occupiedCount = record.seats.filter((s) => s.occupied).length;
  return {
    roomId: record.roomId,
    status: record.status,
    roomVersion: record.roomVersion,
    seats: record.seats.map(toPublicSeat),
    occupiedCount,
    canJoin: record.status === "waiting" && occupiedCount < TOTAL_SEATS,
  };
}

async function getOrLoadRoom(roomId: string): Promise<RoomRecord | null> {
  const inMemory = roomStore.get(roomId);
  if (inMemory) return inMemory;

  const fromDb = await loadRoomFromDb(roomId);
  if (fromDb) {
    roomStore.set(roomId, fromDb);
    return fromDb;
  }
  return null;
}

async function save(record: RoomRecord): Promise<void> {
  record.updatedAt = new Date();
  roomStore.set(record.roomId, record);
  await persistRoom(record);
}

export async function getPublicRoom(roomId: string): Promise<PublicRoom | null> {
  const record = await roomMutex.run(roomId, () => getOrLoadRoom(roomId));
  return record ? toPublicRoom(record) : null;
}

export async function createRoom(
  displayName: string,
  localPlayerCount: 1 | 2 | 3,
): Promise<JoinResult> {
  const roomId = createRoomId();
  const deviceGroupId = createDeviceGroupId();
  const seats = emptySeats();
  const credentials: SeatCredential[] = [];

  for (let i = 0; i < localPlayerCount; i++) {
    const seatToken = createSeatToken();
    credentials.push({ seatIndex: i, seatToken });
    seats[i] = {
      ...seats[i],
      occupied: true,
      displayName: i === 0 ? displayName : `${displayName} (P${i + 1})`,
      kind: "local",
      deviceGroupId,
      seatTokenHash: hashSeatToken(seatToken),
      isHost: i === 0,
      connected: false,
      lastSeenAt: new Date(),
    };
  }

  const now = new Date();
  const record: RoomRecord = {
    roomId,
    status: "waiting",
    hostDeviceGroupId: deviceGroupId,
    seats,
    roomVersion: 1,
    gameState: null,
    gameStateVersion: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + WAITING_TTL_MS),
  };

  await save(record);

  return { room: toPublicRoom(record), deviceGroupId, credentials };
}

export async function joinRoom(
  roomId: string,
  displayName: string,
): Promise<JoinResult> {
  return roomMutex.run(roomId, async () => {
    const record = await getOrLoadRoom(roomId);
    if (!record) {
      throw new RoomServiceError("ROOM_NOT_FOUND", "This room does not exist.");
    }
    if (record.status !== "waiting") {
      throw new RoomServiceError(
        "ROOM_NOT_JOINABLE",
        record.status === "playing"
          ? "This match has already started."
          : "This match has already finished.",
      );
    }
    const seat = record.seats.find((s) => !s.occupied);
    if (!seat) {
      throw new RoomServiceError("ROOM_FULL", "This room is full.");
    }

    const deviceGroupId = createDeviceGroupId();
    const seatToken = createSeatToken();
    seat.occupied = true;
    seat.displayName = displayName;
    seat.kind = "remote";
    seat.deviceGroupId = deviceGroupId;
    seat.seatTokenHash = hashSeatToken(seatToken);
    seat.connected = false;
    seat.lastSeenAt = new Date();

    record.roomVersion += 1;
    await save(record);

    return {
      room: toPublicRoom(record),
      deviceGroupId,
      credentials: [{ seatIndex: seat.seatIndex, seatToken }],
    };
  });
}

/** Validates a seat credential against the stored hash. Pure lookup, no mutation. */
export async function authenticateSeats(
  roomId: string,
  seatTokens: string[],
): Promise<{ record: RoomRecord; seatIndexes: number[] }> {
  const record = await roomMutex.run(roomId, () => getOrLoadRoom(roomId));
  if (!record) {
    throw new RoomServiceError("ROOM_NOT_FOUND", "This room does not exist.");
  }

  const seatIndexes: number[] = [];
  for (const token of seatTokens) {
    const hash = hashSeatToken(token);
    const seat = record.seats.find(
      (s) => s.occupied && s.seatTokenHash === hash,
    );
    if (seat) seatIndexes.push(seat.seatIndex);
  }

  if (seatIndexes.length === 0) {
    throw new RoomServiceError(
      "UNAUTHORIZED",
      "Seat credential is invalid or expired.",
    );
  }

  return { record, seatIndexes };
}

export async function setSeatsConnected(
  roomId: string,
  seatIndexes: number[],
  connected: boolean,
): Promise<RoomRecord> {
  return roomMutex.run(roomId, async () => {
    const record = await getOrLoadRoom(roomId);
    if (!record) {
      throw new RoomServiceError("ROOM_NOT_FOUND", "This room does not exist.");
    }
    for (const seatIndex of seatIndexes) {
      const seat = record.seats.find((s) => s.seatIndex === seatIndex);
      if (seat) {
        seat.connected = connected;
        seat.lastSeenAt = new Date();
      }
    }
    record.roomVersion += 1;
    await save(record);
    return record;
  });
}

export async function leaveRoom(
  roomId: string,
  seatIndexes: number[],
): Promise<RoomRecord> {
  return roomMutex.run(roomId, async () => {
    const record = await getOrLoadRoom(roomId);
    if (!record) {
      throw new RoomServiceError("ROOM_NOT_FOUND", "This room does not exist.");
    }
    if (record.status !== "waiting") {
      throw new RoomServiceError(
        "ROOM_NOT_JOINABLE",
        "Seats cannot be vacated after the match has started.",
      );
    }
    for (const seatIndex of seatIndexes) {
      const seat = record.seats.find((s) => s.seatIndex === seatIndex);
      if (seat) {
        seat.occupied = false;
        seat.displayName = null;
        seat.kind = null;
        seat.deviceGroupId = null;
        seat.seatTokenHash = null;
        seat.isHost = false;
        seat.connected = false;
        seat.lastSeenAt = null;
      }
    }

    const stillHasHost = record.seats.some((s) => s.occupied && s.isHost);
    if (!stillHasHost) {
      const nextHost = record.seats.find((s) => s.occupied);
      if (nextHost) nextHost.isHost = true;
    }

    record.roomVersion += 1;
    await save(record);
    return record;
  });
}

export async function startGame(
  roomId: string,
  requesterSeatIndex: number,
): Promise<RoomRecord> {
  return roomMutex.run(roomId, async () => {
    const record = await getOrLoadRoom(roomId);
    if (!record) {
      throw new RoomServiceError("ROOM_NOT_FOUND", "This room does not exist.");
    }
    const requester = record.seats.find((s) => s.seatIndex === requesterSeatIndex);
    if (!requester?.isHost) {
      throw new RoomServiceError("NOT_HOST", "Only the host can start the game.");
    }
    if (record.status !== "waiting") {
      throw new RoomServiceError(
        "GAME_ALREADY_STARTED",
        "This game has already started.",
      );
    }
    const occupiedSeatIndexes = record.seats
      .filter((s) => s.occupied)
      .map((s) => s.seatIndex as SeatIndex);
    if (occupiedSeatIndexes.length < 2) {
      throw new RoomServiceError(
        "NOT_ENOUGH_PLAYERS",
        "At least two seats must be occupied to start.",
      );
    }

    record.status = "playing";
    record.gameState = createInitialGameState(occupiedSeatIndexes);
    record.gameStateVersion = record.gameState.version;
    record.roomVersion += 1;
    record.expiresAt = new Date(Date.now() + PLAYING_TTL_MS);
    await save(record);
    return record;
  });
}

export interface RollResult {
  record: RoomRecord;
  roll: number;
  legalTokenIds: string[];
  autoSkipped: boolean;
}

export async function rollForSeat(
  roomId: string,
  seatIndex: number,
): Promise<RollResult> {
  return roomMutex.run(roomId, async () => {
    const record = await getOrLoadRoom(roomId);
    if (!record) {
      throw new RoomServiceError("ROOM_NOT_FOUND", "This room does not exist.");
    }
    if (record.status !== "playing" || !record.gameState) {
      throw new RoomServiceError("GAME_NOT_STARTED", "The game has not started.");
    }

    const roll = rollDiceValue();
    const outcome = startTurnRoll(record.gameState, seatIndex, roll);
    record.gameState = outcome.state;
    record.gameStateVersion = outcome.state.version;
    record.expiresAt = new Date(Date.now() + PLAYING_TTL_MS);
    await save(record);

    return {
      record,
      roll,
      legalTokenIds: outcome.legalMoves.map((m) => m.tokenId),
      autoSkipped: outcome.autoSkipped,
    };
  });
}

export interface MoveResult {
  record: RoomRecord;
  events: GameEvent[];
}

export async function moveForSeat(
  roomId: string,
  seatIndex: number,
  tokenId: string,
  diceValue: number,
): Promise<MoveResult> {
  return roomMutex.run(roomId, async () => {
    const record = await getOrLoadRoom(roomId);
    if (!record) {
      throw new RoomServiceError("ROOM_NOT_FOUND", "This room does not exist.");
    }
    if (record.status !== "playing" || !record.gameState) {
      throw new RoomServiceError("GAME_NOT_STARTED", "The game has not started.");
    }

    const { state, events } = applyMove(record.gameState, seatIndex, tokenId, diceValue);
    record.gameState = state;
    record.gameStateVersion = state.version;

    if (state.status === "finished") {
      record.status = "finished";
      record.expiresAt = new Date(Date.now() + FINISHED_TTL_MS);
      record.roomVersion += 1;

      const occupied = record.seats.filter((s) => s.occupied);
      const winnerSeat = occupied.find((s) => s.seatIndex === state.winnerSeatIndex);
      await recordGameHistory({
        roomId,
        players: occupied.map((s) => ({
          seatIndex: s.seatIndex,
          displayName: s.displayName ?? `Seat ${s.seatIndex}`,
          color: s.color,
        })),
        startedAt: record.createdAt,
        finishedAt: new Date(),
        winnerSeatIndex: state.winnerSeatIndex,
        resultSummary: winnerSeat
          ? `${winnerSeat.displayName} (${winnerSeat.color}) won the match.`
          : "Match finished.",
        moveLog: events,
      });
    } else {
      record.expiresAt = new Date(Date.now() + PLAYING_TTL_MS);
    }

    await save(record);
    return { record, events };
  });
}

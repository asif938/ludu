import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  ClientEvents,
  ServerEvents,
  type AuthenticatePayload,
  type ConfigureSeatPayload,
  type MovePayload,
  type RemovePlayerPayload,
  type RollPayload,
} from "@/lib/socket/events";
import {
  authenticatePayloadSchema,
  configureSeatPayloadSchema,
  movePayloadSchema,
  removePlayerPayloadSchema,
  requestStatePayloadSchema,
  rollPayloadSchema,
} from "@/lib/validation/schemas";
import { actionRateLimiter } from "@/lib/socket/rateLimiter";
import { RoomServiceError } from "@/lib/rooms/errors";
import {
  authenticateSeats,
  configureSeat,
  getPublicRoom,
  getRoomSnapshot,
  leaveRoom,
  moveForSeat,
  removePlayerFromMatch,
  rollForSeat,
  setSeatsConnected,
  startGame,
  toPublicRoom,
} from "@/lib/rooms/roomService";
import type { PublicRoom } from "@/lib/rooms/types";
import { roomStore } from "@/lib/rooms/store";
import { getLegalMoves } from "@/lib/game/engine";
import { chooseBotMove } from "@/lib/game/bot";

interface SocketData {
  roomId?: string;
  seatIndexes?: number[];
}

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

function buildRoomUpdatedPayload(room: PublicRoom) {
  const hostSeat = room.seats.find((s) => s.isHost);
  return {
    roomId: room.roomId,
    status: room.status,
    hostSeatIndex: hostSeat?.seatIndex ?? 0,
    seats: room.seats,
    roomVersion: room.roomVersion,
    roomSize: room.roomSize,
    quickMode: room.quickMode,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BOT_ROLL_DELAY_MS = 700;
const BOT_MOVE_DELAY_MS = 650;
/** Quick-mode matches speed bot turns up too, so a full test match against
 * computer opponents takes seconds, not minutes. */
const QUICK_MODE_DELAY_SCALE = 0.3;

/** Drives every consecutive computer-controlled turn for a room, one seat
 * at a time, until a human seat is up or the match ends. Re-entrant-safe:
 * `botLoopRunning` ensures only one loop per room runs at once, since this
 * is called from several socket handlers (start/roll/move/reconnect) that
 * can all observe "the next seat is a bot" at nearly the same time. */
const botLoopRunning = new Set<string>();

async function driveBotTurns(io: Server, roomId: string): Promise<void> {
  if (botLoopRunning.has(roomId)) return;
  botLoopRunning.add(roomId);
  try {
    for (;;) {
      const record = await getRoomSnapshot(roomId);
      if (!record || record.status !== "playing" || !record.gameState) return;
      const state = record.gameState;
      const seatIndex = state.turnOrder[state.currentTurnIndex];
      const seat = record.seats.find((s) => s.seatIndex === seatIndex);
      if (!seat || seat.kind !== "bot") return;

      const scale = record.quickMode ? QUICK_MODE_DELAY_SCALE : 1;

      if (state.pendingRoll === null) {
        await wait(BOT_ROLL_DELAY_MS * scale);
        const result = await rollForSeat(roomId, seatIndex);
        io.to(roomChannel(roomId)).emit(ServerEvents.DiceRolled, {
          roomId,
          seatIndex,
          roll: result.roll,
          legalTokenIds: result.legalTokenIds,
        });
        io.to(roomChannel(roomId)).emit(ServerEvents.GameState, {
          roomId,
          state: result.record.gameState,
        });
        if (result.record.gameState?.status !== "playing") return;
        continue;
      }

      await wait(BOT_MOVE_DELAY_MS * scale);
      const legalMoves = getLegalMoves(state, seatIndex, state.pendingRoll);
      if (legalMoves.length === 0) return; // defensive; the engine auto-skips empty-move rolls
      const chosen = chooseBotMove(state, seatIndex, legalMoves);
      const { record: movedRecord, events } = await moveForSeat(
        roomId,
        seatIndex,
        chosen.tokenId,
        state.pendingRoll,
      );
      for (const event of events) {
        io.to(roomChannel(roomId)).emit(ServerEvents.TokenMoved, {
          roomId,
          seatIndex,
          tokenId: chosen.tokenId,
          event,
        });
      }
      io.to(roomChannel(roomId)).emit(ServerEvents.GameState, {
        roomId,
        state: movedRecord.gameState,
      });
      if (movedRecord.gameState?.status === "finished") {
        io.to(roomChannel(roomId)).emit(ServerEvents.Finished, {
          roomId,
          winnerSeatIndex: movedRecord.gameState.winnerSeatIndex,
        });
        return;
      }
    }
  } catch (err) {
    console.error("[bot] turn failed", err);
  } finally {
    botLoopRunning.delete(roomId);
  }
}

function emitError(socket: Socket, err: unknown) {
  if (err instanceof RoomServiceError) {
    socket.emit(ServerEvents.Error, { code: err.code, message: err.message });
    return;
  }
  console.error("[socket] unexpected error", err);
  socket.emit(ServerEvents.Error, {
    code: "INTERNAL",
    message: "Something went wrong. Please try again.",
  });
}

export function attachSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: process.env.APP_ORIGIN?.split(",") ?? "*",
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;

    async function authenticate(raw: unknown) {
      const parsed = authenticatePayloadSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit(ServerEvents.Error, {
          code: "VALIDATION_ERROR",
          message: "Invalid join request.",
        });
        return;
      }
      const { roomId, seatTokens }: AuthenticatePayload = parsed.data;
      try {
        const { seatIndexes } = await authenticateSeats(roomId, seatTokens);
        data.roomId = roomId;
        data.seatIndexes = seatIndexes;
        await socket.join(roomChannel(roomId));

        const record = await setSeatsConnected(roomId, seatIndexes, true);
        const publicRoom = toPublicRoom(record);

        socket.emit(ServerEvents.Joined, {
          room: publicRoom,
          seatIndexes,
        });
        io.to(roomChannel(roomId)).emit(
          ServerEvents.Updated,
          buildRoomUpdatedPayload(publicRoom),
        );
        io.to(roomChannel(roomId)).emit(ServerEvents.PlayerReconnected, {
          roomId,
          seatIndexes,
        });

        if (record.status === "playing" && record.gameState) {
          socket.emit(ServerEvents.GameState, { roomId, state: record.gameState });
          void driveBotTurns(io, roomId);
        }
      } catch (err) {
        emitError(socket, err);
      }
    }

    socket.on(ClientEvents.Authenticate, authenticate);
    socket.on(ClientEvents.Reconnect, authenticate);

    socket.on(ClientEvents.RequestState, async (raw: unknown) => {
      const parsed = requestStatePayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId } = parsed.data;
      if (data.roomId !== roomId) return;
      try {
        const record = roomStore.get(roomId);
        if (!record) throw new RoomServiceError("ROOM_NOT_FOUND", "Room not found.");
        const publicRoom = toPublicRoom(record);
        socket.emit(ServerEvents.Updated, buildRoomUpdatedPayload(publicRoom));
        if (record.gameState) {
          socket.emit(ServerEvents.GameState, { roomId, state: record.gameState });
        }
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on(ClientEvents.Leave, async (raw: unknown) => {
      const roomId = typeof raw === "object" && raw && "roomId" in raw ? String((raw as { roomId: unknown }).roomId) : data.roomId;
      if (!roomId || !data.seatIndexes?.length) return;
      try {
        const record = await leaveRoom(roomId, data.seatIndexes);
        const publicRoom = toPublicRoom(record);
        io.to(roomChannel(roomId)).emit(
          ServerEvents.Updated,
          buildRoomUpdatedPayload(publicRoom),
        );
        socket.leave(roomChannel(roomId));
        data.roomId = undefined;
        data.seatIndexes = undefined;
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on(ClientEvents.Start, async (raw: unknown) => {
      const roomId = typeof raw === "object" && raw && "roomId" in raw ? String((raw as { roomId: unknown }).roomId) : undefined;
      if (!roomId || data.roomId !== roomId || !data.seatIndexes) return;
      try {
        const publicRoom = await getPublicRoom(roomId);
        const hostSeatIndex = publicRoom?.seats.find((s) => s.isHost)?.seatIndex;
        if (hostSeatIndex === undefined || !data.seatIndexes.includes(hostSeatIndex)) {
          throw new RoomServiceError("NOT_HOST", "Only the host can start the game.");
        }
        const record = await startGame(roomId, hostSeatIndex);
        io.to(roomChannel(roomId)).emit(
          ServerEvents.Updated,
          buildRoomUpdatedPayload(toPublicRoom(record)),
        );
        io.to(roomChannel(roomId)).emit(ServerEvents.GameStarted, {
          roomId,
          state: record.gameState,
        });
        io.to(roomChannel(roomId)).emit(ServerEvents.GameState, {
          roomId,
          state: record.gameState,
        });
        void driveBotTurns(io, roomId);
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on(ClientEvents.Roll, async (raw: unknown) => {
      const parsed = rollPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit(ServerEvents.Error, {
          code: "VALIDATION_ERROR",
          message: "Invalid roll request.",
        });
        return;
      }
      const { roomId, seatIndex }: RollPayload = parsed.data;
      if (data.roomId !== roomId || !data.seatIndexes?.includes(seatIndex)) {
        emitError(socket, new RoomServiceError("UNAUTHORIZED", "You do not control that seat."));
        return;
      }
      if (!actionRateLimiter.allow(`${socket.id}:roll`)) {
        emitError(socket, new RoomServiceError("RATE_LIMITED", "Please slow down."));
        return;
      }
      try {
        const result = await rollForSeat(roomId, seatIndex);
        io.to(roomChannel(roomId)).emit(ServerEvents.DiceRolled, {
          roomId,
          seatIndex,
          roll: result.roll,
          legalTokenIds: result.legalTokenIds,
        });
        io.to(roomChannel(roomId)).emit(ServerEvents.GameState, {
          roomId,
          state: result.record.gameState,
        });
        void driveBotTurns(io, roomId);
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on(ClientEvents.Move, async (raw: unknown) => {
      const parsed = movePayloadSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit(ServerEvents.Error, {
          code: "VALIDATION_ERROR",
          message: "Invalid move request.",
        });
        return;
      }
      const { roomId, seatIndex, tokenId, diceValue }: MovePayload = parsed.data;
      if (data.roomId !== roomId || !data.seatIndexes?.includes(seatIndex)) {
        emitError(socket, new RoomServiceError("UNAUTHORIZED", "You do not control that seat."));
        return;
      }
      if (!actionRateLimiter.allow(`${socket.id}:move`)) {
        emitError(socket, new RoomServiceError("RATE_LIMITED", "Please slow down."));
        return;
      }
      try {
        const { record, events } = await moveForSeat(roomId, seatIndex, tokenId, diceValue);
        for (const event of events) {
          io.to(roomChannel(roomId)).emit(ServerEvents.TokenMoved, {
            roomId,
            seatIndex,
            tokenId,
            event,
          });
        }
        io.to(roomChannel(roomId)).emit(ServerEvents.GameState, {
          roomId,
          state: record.gameState,
        });
        if (record.gameState?.status === "finished") {
          io.to(roomChannel(roomId)).emit(ServerEvents.Finished, {
            roomId,
            winnerSeatIndex: record.gameState.winnerSeatIndex,
          });
        } else {
          void driveBotTurns(io, roomId);
        }
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on(ClientEvents.RemovePlayer, async (raw: unknown) => {
      const parsed = removePlayerPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit(ServerEvents.Error, {
          code: "VALIDATION_ERROR",
          message: "Invalid request.",
        });
        return;
      }
      const { roomId, targetSeatIndex }: RemovePlayerPayload = parsed.data;
      if (data.roomId !== roomId || !data.seatIndexes?.length) {
        emitError(socket, new RoomServiceError("UNAUTHORIZED", "You are not in this room."));
        return;
      }
      try {
        const publicRoom = await getPublicRoom(roomId);
        const hostSeatIndex = publicRoom?.seats.find((s) => s.isHost)?.seatIndex;
        if (hostSeatIndex === undefined || !data.seatIndexes.includes(hostSeatIndex)) {
          throw new RoomServiceError("NOT_HOST", "Only the host can remove a player.");
        }
        const { record } = await removePlayerFromMatch(roomId, hostSeatIndex, targetSeatIndex);
        io.to(roomChannel(roomId)).emit(ServerEvents.GameState, {
          roomId,
          state: record.gameState,
        });
        if (record.gameState?.status === "finished") {
          io.to(roomChannel(roomId)).emit(ServerEvents.Finished, {
            roomId,
            winnerSeatIndex: record.gameState.winnerSeatIndex,
          });
        } else {
          void driveBotTurns(io, roomId);
        }
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on(ClientEvents.ConfigureSeat, async (raw: unknown) => {
      const parsed = configureSeatPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit(ServerEvents.Error, {
          code: "VALIDATION_ERROR",
          message: "Invalid request.",
        });
        return;
      }
      const { roomId, targetSeatIndex, mode }: ConfigureSeatPayload = parsed.data;
      if (data.roomId !== roomId || !data.seatIndexes?.length) {
        emitError(socket, new RoomServiceError("UNAUTHORIZED", "You are not in this room."));
        return;
      }
      try {
        const publicRoom = await getPublicRoom(roomId);
        const hostSeatIndex = publicRoom?.seats.find((s) => s.isHost)?.seatIndex;
        if (hostSeatIndex === undefined || !data.seatIndexes.includes(hostSeatIndex)) {
          throw new RoomServiceError("NOT_HOST", "Only the host can configure seats.");
        }
        const record = await configureSeat(roomId, hostSeatIndex, targetSeatIndex, mode);
        io.to(roomChannel(roomId)).emit(
          ServerEvents.Updated,
          buildRoomUpdatedPayload(toPublicRoom(record)),
        );
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on("disconnect", async () => {
      actionRateLimiter.clear(`${socket.id}:roll`);
      actionRateLimiter.clear(`${socket.id}:move`);
      const { roomId, seatIndexes } = data;
      if (!roomId || !seatIndexes?.length) return;
      try {
        const record = await setSeatsConnected(roomId, seatIndexes, false);
        const publicRoom = toPublicRoom(record);
        io.to(roomChannel(roomId)).emit(
          ServerEvents.Updated,
          buildRoomUpdatedPayload(publicRoom),
        );
        io.to(roomChannel(roomId)).emit(ServerEvents.PlayerDisconnected, {
          roomId,
          seatIndexes,
        });
      } catch {
        // Room may already be gone (expired/finished cleanup) — nothing to do.
      }
    });
  });

  return io;
}

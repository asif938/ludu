export type RoomErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_NOT_JOINABLE"
  | "INVALID_SEAT"
  | "UNAUTHORIZED"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "GAME_ALREADY_STARTED"
  | "GAME_NOT_STARTED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED";

export class RoomServiceError extends Error {
  code: RoomErrorCode;
  constructor(code: RoomErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "RoomServiceError";
  }
}

import { NextResponse } from "next/server";
import { joinRoomSchema, roomIdParamSchema } from "@/lib/validation/schemas";
import { joinRoom } from "@/lib/rooms/roomService";
import { RoomServiceError } from "@/lib/rooms/errors";

const STATUS_BY_CODE: Record<string, number> = {
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  ROOM_NOT_JOINABLE: 409,
  VALIDATION_ERROR: 400,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId: rawRoomId } = await params;
  const roomId = rawRoomId.toUpperCase();

  const roomIdCheck = roomIdParamSchema.safeParse(roomId);
  if (!roomIdCheck.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid room code." } },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  const parsed = joinRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid request.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await joinRoom(roomIdCheck.data, parsed.data.displayName);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof RoomServiceError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: STATUS_BY_CODE[err.code] ?? 400 },
      );
    }
    console.error("[api] join room failed", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong." } },
      { status: 500 },
    );
  }
}

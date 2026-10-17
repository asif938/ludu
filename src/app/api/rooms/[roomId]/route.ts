import { NextResponse } from "next/server";
import { roomIdParamSchema } from "@/lib/validation/schemas";
import { getPublicRoom } from "@/lib/rooms/roomService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId: rawRoomId } = await params;
  const roomId = rawRoomId.toUpperCase();

  const parsed = roomIdParamSchema.safeParse(roomId);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid room code." } },
      { status: 400 },
    );
  }

  const room = await getPublicRoom(parsed.data);
  if (!room) {
    return NextResponse.json(
      { error: { code: "ROOM_NOT_FOUND", message: "This room does not exist." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ room });
}

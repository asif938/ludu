import { NextResponse } from "next/server";
import { createRoomSchema } from "@/lib/validation/schemas";
import { createRoom } from "@/lib/rooms/roomService";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  const parsed = createRoomSchema.safeParse(body);
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

  const result = await createRoom(parsed.data.displayName, parsed.data.localPlayerCount);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const inviteUrl = `${baseUrl.replace(/\/$/, "")}/room/${result.room.roomId}`;

  return NextResponse.json({ ...result, inviteUrl }, { status: 201 });
}

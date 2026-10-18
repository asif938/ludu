import { z } from "zod";

const displayName = z
  .string()
  .trim()
  .min(1, "Display name is required.")
  .max(20, "Display name must be 20 characters or fewer.");

export const createRoomSchema = z
  .object({
    displayName,
    localPlayerCount: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    roomSize: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    botCount: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    quickMode: z.boolean(),
  })
  .refine((v) => v.localPlayerCount + v.botCount <= v.roomSize, {
    message: "Too many players for the selected room size.",
    path: ["botCount"],
  });
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const joinRoomSchema = z.object({
  displayName,
});
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

export const roomIdParamSchema = z
  .string()
  .trim()
  .min(4)
  .max(16)
  .regex(/^[A-Z0-9]+$/, "Invalid room code.");

export const authenticatePayloadSchema = z.object({
  roomId: roomIdParamSchema,
  seatTokens: z.array(z.string().min(10).max(200)).min(1).max(4),
});

export const rollPayloadSchema = z.object({
  roomId: roomIdParamSchema,
  seatIndex: z.number().int().min(0).max(3),
});

export const movePayloadSchema = z.object({
  roomId: roomIdParamSchema,
  seatIndex: z.number().int().min(0).max(3),
  tokenId: z.string().min(1).max(32),
  diceValue: z.number().int().min(1).max(6),
});

export const requestStatePayloadSchema = z.object({
  roomId: roomIdParamSchema,
});

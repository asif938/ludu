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

export const removePlayerPayloadSchema = z.object({
  roomId: roomIdParamSchema,
  targetSeatIndex: z.number().int().min(0).max(3),
});

const guaranteeWindowSchema = z.object({
  enabled: z.boolean(),
  grace: z.number().int().min(0).max(20),
  guarantee: z.number().int().min(1).max(20),
});

const perMatchGuaranteeSchema = z.object({
  quick: guaranteeWindowSchema,
  normal: guaranteeWindowSchema,
});

const normalOnlyGuaranteeSchema = z.object({
  normal: guaranteeWindowSchema,
});

const consecutiveOneCapPerMatchSchema = z.object({
  enabled: z.boolean(),
  maxConsecutive: z.number().int().min(1).max(10),
});

const fiveTurnOneRestrictionPerMatchSchema = z.object({
  enabled: z.boolean(),
  blockTurnsAfterOne: z.number().int().min(0).max(20),
});

export const diceRulesConfigSchema = z.object({
  sixGuarantee: z.object({
    firstToken: perMatchGuaranteeSchema,
    secondToken: perMatchGuaranteeSchema,
    thirdToken: normalOnlyGuaranteeSchema,
    fourthToken: normalOnlyGuaranteeSchema,
  }),
  consecutiveOneCap: z.object({
    quick: consecutiveOneCapPerMatchSchema,
    normal: consecutiveOneCapPerMatchSchema,
  }),
  fiveTurnOneRestriction: z.object({
    quick: fiveTurnOneRestrictionPerMatchSchema,
    normal: fiveTurnOneRestrictionPerMatchSchema,
  }),
});
export type DiceRulesConfigInput = z.infer<typeof diceRulesConfigSchema>;

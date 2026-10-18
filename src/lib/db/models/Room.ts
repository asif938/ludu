import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const SeatSchema = new Schema(
  {
    seatIndex: { type: Number, required: true, min: 0, max: 3 },
    color: { type: String, required: true, enum: ["red", "green", "yellow", "blue"] },
    occupied: { type: Boolean, required: true, default: false },
    displayName: { type: String, default: null },
    kind: { type: String, enum: ["local", "remote", "bot"], default: null },
    deviceGroupId: { type: String, default: null },
    seatTokenHash: { type: String, default: null },
    isHost: { type: Boolean, default: false },
    connected: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
  },
  { _id: false },
);

const RoomSchema = new Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["waiting", "playing", "finished"],
      default: "waiting",
      required: true,
    },
    hostDeviceGroupId: { type: String, required: true },
    seats: { type: [SeatSchema], required: true },
    roomSize: { type: Number, enum: [2, 3, 4], default: 4 },
    quickMode: { type: Boolean, default: false },
    roomVersion: { type: Number, required: true, default: 1 },
    gameState: { type: Schema.Types.Mixed, default: null },
    gameStateVersion: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

export type RoomDocument = InferSchemaType<typeof RoomSchema>;

export const RoomModel: Model<RoomDocument> =
  (models.Room as Model<RoomDocument>) ?? model<RoomDocument>("Room", RoomSchema);

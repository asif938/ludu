import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const GameHistorySchema = new Schema(
  {
    roomId: { type: String, required: true, index: true },
    players: [
      {
        seatIndex: { type: Number, required: true },
        displayName: { type: String, required: true },
        color: { type: String, required: true },
      },
    ],
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    winnerSeatIndex: { type: Number, default: null },
    resultSummary: { type: String, required: true },
    /** Optional, lightweight move log — capped to avoid unbounded growth. */
    moveLog: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

export type GameHistoryDocument = InferSchemaType<typeof GameHistorySchema>;

export const GameHistoryModel: Model<GameHistoryDocument> =
  (models.GameHistory as Model<GameHistoryDocument>) ??
  model<GameHistoryDocument>("GameHistory", GameHistorySchema);

import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const DiceRulesSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true, default: "default" },
    config: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export type DiceRulesSettingsDocument = InferSchemaType<typeof DiceRulesSettingsSchema>;

export const DiceRulesSettingsModel: Model<DiceRulesSettingsDocument> =
  (models.DiceRulesSettings as Model<DiceRulesSettingsDocument>) ??
  model<DiceRulesSettingsDocument>("DiceRulesSettings", DiceRulesSettingsSchema);

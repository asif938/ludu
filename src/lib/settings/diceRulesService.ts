import { connectToDatabase, isPersistenceConfigured } from "@/lib/db/mongodb";
import { DiceRulesSettingsModel } from "@/lib/db/models/DiceRulesSettings";
import { createDefaultDiceRulesConfig, type DiceRulesConfig } from "@/lib/game/diceRules";

/**
 * Single global config (not per-room) controlling every dice rule, editable
 * from /settings. Mirrors the room store's pattern: an in-memory value the
 * server reads on every roll, optionally mirrored to MongoDB so it survives
 * a restart when persistence is configured (see lib/db/mongodb.ts).
 */

const SETTINGS_KEY = "default";

declare global {
  var __ludoDiceRulesConfig: DiceRulesConfig | undefined;
}

let cached: DiceRulesConfig | undefined = globalThis.__ludoDiceRulesConfig;

export async function getDiceRulesConfig(): Promise<DiceRulesConfig> {
  if (cached) return cached;

  const fromDb = await loadFromDb();
  cached = fromDb ?? createDefaultDiceRulesConfig();
  globalThis.__ludoDiceRulesConfig = cached;
  return cached;
}

export async function setDiceRulesConfig(next: DiceRulesConfig): Promise<DiceRulesConfig> {
  cached = next;
  globalThis.__ludoDiceRulesConfig = cached;
  await persistToDb(next);
  return cached;
}

export async function resetDiceRulesConfig(): Promise<DiceRulesConfig> {
  return setDiceRulesConfig(createDefaultDiceRulesConfig());
}

async function loadFromDb(): Promise<DiceRulesConfig | null> {
  if (!isPersistenceConfigured()) return null;
  await connectToDatabase();
  const doc = await DiceRulesSettingsModel.findOne({ key: SETTINGS_KEY }).lean();
  return (doc?.config as DiceRulesConfig | undefined) ?? null;
}

async function persistToDb(config: DiceRulesConfig): Promise<void> {
  if (!isPersistenceConfigured()) return;
  await connectToDatabase();
  await DiceRulesSettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { key: SETTINGS_KEY, config },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

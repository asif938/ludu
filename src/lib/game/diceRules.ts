/**
 * Configuration shape for every dice-related rule the engine applies on
 * top of a fair 1-6 roll. Pure data — no framework or storage dependency,
 * matching engine.ts's own "zero dependencies" rule. The *default* values
 * here are exactly the numbers that were previously hardcoded directly in
 * engine.ts, so leaving every rule at its default reproduces the original
 * behavior precisely.
 *
 * "Quick" / "Normal" refer to the 2-token and 4-token match variants
 * (QUICK_TOKENS_PER_PLAYER / TOKENS_PER_PLAYER in config.ts).
 */

export type MatchType = "quick" | "normal";

/** One "release the next token" guarantee window: `grace` turns roll with
 * no forcing at all (a natural 6 there satisfies the rule on its own); if
 * none lands, a 6 is guaranteed on one randomly chosen turn among the
 * following `guarantee` turns. */
export interface GuaranteeWindowConfig {
  enabled: boolean;
  grace: number;
  guarantee: number;
}

export interface PerMatchGuaranteeConfig {
  quick: GuaranteeWindowConfig;
  normal: GuaranteeWindowConfig;
}

export interface NormalOnlyGuaranteeConfig {
  normal: GuaranteeWindowConfig;
}

export interface SixGuaranteeConfig {
  /** Releasing the 1st token (starts the moment every token is in the yard). */
  firstToken: PerMatchGuaranteeConfig;
  /** Releasing the 2nd token, once the 1st has left the yard. */
  secondToken: PerMatchGuaranteeConfig;
  /** Releasing the 3rd token — Normal match only (Quick has 2 tokens total). */
  thirdToken: NormalOnlyGuaranteeConfig;
  /** Releasing the 4th token — Normal match only. */
  fourthToken: NormalOnlyGuaranteeConfig;
}

export interface ConsecutiveOneCapPerMatchConfig {
  enabled: boolean;
  /** A player may roll this many 1s back-to-back; the next one is blocked. */
  maxConsecutive: number;
}

export interface ConsecutiveOneCapConfig {
  quick: ConsecutiveOneCapPerMatchConfig;
  normal: ConsecutiveOneCapPerMatchConfig;
}

export interface FiveTurnOneRestrictionPerMatchConfig {
  enabled: boolean;
  /** After a 1, how many of the player's own following turns must roll 2-6. */
  blockTurnsAfterOne: number;
}

export interface FiveTurnOneRestrictionConfig {
  quick: FiveTurnOneRestrictionPerMatchConfig;
  normal: FiveTurnOneRestrictionPerMatchConfig;
}

export interface DiceRulesConfig {
  sixGuarantee: SixGuaranteeConfig;
  consecutiveOneCap: ConsecutiveOneCapConfig;
  fiveTurnOneRestriction: FiveTurnOneRestrictionConfig;
}

function guaranteeWindow(grace: number, guarantee: number): GuaranteeWindowConfig {
  return { enabled: true, grace, guarantee };
}

/** Always returns a fresh object — callers may freely mutate their copy. */
export function createDefaultDiceRulesConfig(): DiceRulesConfig {
  return {
    sixGuarantee: {
      firstToken: {
        quick: guaranteeWindow(0, 5),
        normal: guaranteeWindow(0, 5),
      },
      secondToken: {
        quick: guaranteeWindow(4, 3),
        normal: guaranteeWindow(4, 3),
      },
      thirdToken: {
        normal: guaranteeWindow(4, 3),
      },
      fourthToken: {
        normal: guaranteeWindow(5, 4),
      },
    },
    consecutiveOneCap: {
      quick: { enabled: true, maxConsecutive: 2 },
      normal: { enabled: true, maxConsecutive: 2 },
    },
    fiveTurnOneRestriction: {
      quick: { enabled: true, blockTurnsAfterOne: 4 },
      normal: { enabled: true, blockTurnsAfterOne: 4 },
    },
  };
}

export const DEFAULT_DICE_RULES_CONFIG: DiceRulesConfig = createDefaultDiceRulesConfig();

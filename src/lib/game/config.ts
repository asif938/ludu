/**
 * Centralized Ludo board configuration.
 *
 * All movement rules (path layout, safe squares, home-stretch transitions)
 * live here so engine.ts and the UI both read from one source of truth
 * instead of scattering magic numbers across components.
 *
 * Path model
 * ----------
 * - The shared outer track has TRACK_LENGTH (52) cells, indexed 0-51.
 * - Each color has a START_OFFSET on that shared track (its entry square).
 * - A token's "progress" is measured relative to its own start square:
 *     progress 0        -> sitting on its own start square (just released)
 *     progress 1-50     -> advancing along the shared track
 *     progress 51-55    -> inside its private 5-cell home stretch
 *     progress 56       -> the final home cell (token has finished)
 *   This gives TOTAL_STEPS = 56 as the exact distance from start to home,
 *   matching the classic 51-square lap + 6-cell home column layout.
 * - Absolute shared-track cell for progress p (0 <= p <= 50) is:
 *     (START_OFFSET[color] + p) % TRACK_LENGTH
 *   Progress 51-56 is in a private lane and never collides with other colors.
 */

import type { PlayerColor } from "./types";

export const COLOR_ORDER: PlayerColor[] = ["red", "green", "yellow", "blue"];

export const TRACK_LENGTH = 52;
export const HOME_STRETCH_LENGTH = 6; // progress 51..56 (56 is the final cell)
export const LAST_MAIN_PATH_PROGRESS = 50; // last step before entering home stretch
export const FINISH_PROGRESS = 56;
export const TOKENS_PER_PLAYER = 4;
/** Quick/test-mode token count: fewer tokens per player so a full match
 * (release, advance, capture, win) finishes in a couple of minutes while
 * exercising every rule path. */
export const QUICK_TOKENS_PER_PLAYER = 2;

/** Entry square (absolute shared-track index) for each color. */
export const START_OFFSET: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/**
 * Safe squares on the shared track (absolute indexes): every color's start
 * square plus one additional "star" square per color, spaced 8 cells after
 * each start. Tokens here can never be captured.
 */
export const SAFE_SQUARES: ReadonlySet<number> = new Set([
  ...Object.values(START_OFFSET),
  ...Object.values(START_OFFSET).map((offset) => (offset + 8) % TRACK_LENGTH),
]);

export function absoluteCellForProgress(
  color: PlayerColor,
  progress: number,
): number | null {
  if (progress < 0 || progress > LAST_MAIN_PATH_PROGRESS) return null;
  return (START_OFFSET[color] + progress) % TRACK_LENGTH;
}

export function isSafeCell(cell: number): boolean {
  return SAFE_SQUARES.has(cell);
}

export function colorForSeat(seatIndex: number): PlayerColor {
  const color = COLOR_ORDER[seatIndex];
  if (!color) throw new Error(`Invalid seat index: ${seatIndex}`);
  return color;
}

/** Design decisions documented explicitly per project requirements:
 * - Three-consecutive-sixes-cancels-turn is NOT implemented (MVP scope).
 * - Rolling a six grants an extra roll; captures/reaching home do not.
 * - No "blocking" rule: multiple tokens (own or stacked) may share a cell;
 *   only opponent tokens on non-safe shared cells are captured.
 * - First player to finish all 4 tokens wins immediately; the match ends
 *   (no 2nd/3rd place tracking in the MVP).
 */

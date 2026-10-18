import {
  absoluteCellForProgress,
  COLOR_ORDER,
  LAST_MAIN_PATH_PROGRESS,
} from "@/lib/game/config";
import type { PlayerColor, TokenState } from "@/lib/game/types";

/**
 * Visual board geometry for the classic 15x15 Ludo cross layout.
 *
 * Rather than hand-listing all 52 path cells + 24 home-stretch cells (error
 * prone), we define RED's own 13-cell quarter of the loop and its 6-cell
 * home stretch once, then generate the other three colors' coordinates by
 * rotating 90repeatedly around the board center — exactly how the real
 * board is laid out, and it keeps the four quarters guaranteed consistent.
 */

export const GRID_SIZE = 15;

type Cell = readonly [row: number, col: number];

/** Rotate a grid coordinate 90° clockwise around the 15x15 board center. */
function rotateCW([row, col]: Cell): Cell {
  return [col, GRID_SIZE - 1 - row];
}

function rotateN(cell: Cell, times: number): Cell {
  let result = cell;
  for (let i = 0; i < times; i++) result = rotateCW(result);
  return result;
}

const COLOR_STEPS: Record<PlayerColor, number> = {
  red: 0,
  green: 1,
  yellow: 2,
  blue: 3,
};

/** Red's quarter of the shared 52-cell loop (progress 0-12 for red). */
const RED_MAIN_ARC: Cell[] = [
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  [0, 7],
  [0, 8],
];

/** Red's private 6-cell home stretch (progress 51-56). */
const RED_HOME_STRETCH: Cell[] = [
  [7, 1],
  [7, 2],
  [7, 3],
  [7, 4],
  [7, 5],
  [7, 6],
];

/** Red's 4 yard token slots, inside its 6x6 corner. */
const RED_YARD_SLOTS: Cell[] = [
  [1.5, 1.5],
  [1.5, 3.5],
  [3.5, 1.5],
  [3.5, 3.5],
];

/** Absolute shared-track cell -> grid coordinate, for cell 0..51. */
export const ABSOLUTE_PATH_COORDS: Cell[] = [0, 1, 2, 3].flatMap((n) =>
  RED_MAIN_ARC.map((cell) => rotateN(cell, n)),
);

export const HOME_STRETCH_COORDS: Record<PlayerColor, Cell[]> = Object.fromEntries(
  COLOR_ORDER.map((color) => [
    color,
    RED_HOME_STRETCH.map((cell) => rotateN(cell, COLOR_STEPS[color])),
  ]),
) as Record<PlayerColor, Cell[]>;

export const YARD_SLOT_COORDS: Record<PlayerColor, Cell[]> = Object.fromEntries(
  COLOR_ORDER.map((color) => [
    color,
    RED_YARD_SLOTS.map((cell) => rotateN(cell, COLOR_STEPS[color])),
  ]),
) as Record<PlayerColor, Cell[]>;

/** Top-left (row, col) of each color's 6x6 yard square. */
export const YARD_BOUNDS: Record<PlayerColor, { row: number; col: number }> = {
  red: { row: 0, col: 0 },
  green: { row: 0, col: 9 },
  yellow: { row: 9, col: 9 },
  blue: { row: 9, col: 0 },
};

/** Safe-square star positions as (row, col), derived the same way the
 * engine derives them (start squares + 8 cells after each start). */
export function starCoordinates(): Cell[] {
  return COLOR_ORDER.map((_, i) => ABSOLUTE_PATH_COORDS[(i * 13 + 8) % 52]);
}

export function tokenYardSlotIndex(tokenId: string): number {
  return Number(tokenId.split("-")[1] ?? 0);
}

/**
 * Where the dice should sit relative to the board on small screens, driven
 * by the active player's own yard corner rather than a fixed spot: above
 * the board for a top-row color, below it for a bottom-row color, and
 * left/right-aligned to match that color's column.
 */
export function diceAnchorForColor(
  color: PlayerColor,
): { vertical: "above" | "below"; horizontal: "left" | "right" } {
  const bounds = YARD_BOUNDS[color];
  return {
    vertical: bounds.row === 0 ? "above" : "below",
    horizontal: bounds.col === 0 ? "left" : "right",
  };
}

/** Grid coordinate for a token in its current state — the single place
 * Board.tsx asks "where does this token render". */
export function tokenCoordinate(token: TokenState): Cell {
  if (token.status === "yard" || token.progress === undefined) {
    return YARD_SLOT_COORDS[token.color][tokenYardSlotIndex(token.id)];
  }
  if (token.progress <= LAST_MAIN_PATH_PROGRESS) {
    const absCell = absoluteCellForProgress(token.color, token.progress)!;
    return ABSOLUTE_PATH_COORDS[absCell];
  }
  const homeIndex = token.progress - (LAST_MAIN_PATH_PROGRESS + 1);
  return HOME_STRETCH_COORDS[token.color][homeIndex];
}

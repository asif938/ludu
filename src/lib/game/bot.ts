/**
 * Simple heuristic AI for computer-controlled seats. Pure and
 * deterministic-given-state: it only picks among the legal moves the
 * engine already computed, never invents a move, so it can never violate
 * a rule the engine wouldn't already enforce.
 *
 * Priority: finish a token > capture an opponent > release a yard token >
 * advance the token that is furthest along (closest to home).
 */

import { absoluteCellForProgress, FINISH_PROGRESS, isSafeCell } from "./config";
import type { GameState, LegalMove, PlayerState } from "./types";

function countCapturableOpponents(
  state: GameState,
  seatIndex: number,
  cell: number,
): number {
  let count = 0;
  for (const other of state.players) {
    if (other.seatIndex === seatIndex) continue;
    for (const token of other.tokens) {
      if (
        token.status === "active" &&
        token.progress !== undefined &&
        absoluteCellForProgress(token.color, token.progress) === cell
      ) {
        count += 1;
      }
    }
  }
  return count;
}

function scoreMove(state: GameState, player: PlayerState, move: LegalMove): number {
  if (move.kind === "release") {
    // Getting a token out of the yard is valuable but never better than
    // finishing or capturing with an already-active token.
    return 100;
  }

  let score = move.toProgress; // mild preference for the furthest-along token

  if (move.toProgress === FINISH_PROGRESS) {
    score += 1000;
  }

  const cell = absoluteCellForProgress(player.color, move.toProgress);
  if (cell !== null && !isSafeCell(cell)) {
    const captures = countCapturableOpponents(state, player.seatIndex, cell);
    score += captures * 500;
  }

  return score;
}

/** Picks one move from the engine-provided legal set. `legalMoves` must be
 * non-empty (callers already know that — the engine auto-skips otherwise). */
export function chooseBotMove(
  state: GameState,
  seatIndex: number,
  legalMoves: LegalMove[],
): LegalMove {
  const player = state.players.find((p) => p.seatIndex === seatIndex);
  if (!player) return legalMoves[0];

  let best = legalMoves[0];
  let bestScore = scoreMove(state, player, best);
  for (const move of legalMoves.slice(1)) {
    const score = scoreMove(state, player, move);
    if (score > bestScore) {
      best = move;
      bestScore = score;
    }
  }
  return best;
}

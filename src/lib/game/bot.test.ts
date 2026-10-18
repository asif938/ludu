import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./engine";
import { chooseBotMove } from "./bot";
import { START_OFFSET } from "./config";
import type { GameState } from "./types";

function withTokenProgress(
  state: GameState,
  seatIndex: number,
  tokenId: string,
  progress: number,
): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.seatIndex !== seatIndex
        ? p
        : {
            ...p,
            tokens: p.tokens.map((t) =>
              t.id === tokenId ? { ...t, status: "active" as const, progress } : t,
            ),
          },
    ),
  };
}

describe("chooseBotMove", () => {
  it("prefers a capturing move over a plain advance", () => {
    let state = createInitialGameState([0, 1]);
    // green-0 sits where red-0 would land (absolute cell 11, unsafe).
    state = withTokenProgress(state, 1, "green-0", (11 - START_OFFSET.green + 52) % 52);
    state = withTokenProgress(state, 0, "red-0", 7);
    state = withTokenProgress(state, 0, "red-1", 20);

    const legalMoves = [
      { tokenId: "red-0", kind: "advance" as const, toProgress: 11 },
      { tokenId: "red-1", kind: "advance" as const, toProgress: 24 },
    ];
    const chosen = chooseBotMove(state, 0, legalMoves);
    expect(chosen.tokenId).toBe("red-0");
  });

  it("prefers finishing a token over any other move", () => {
    let state = createInitialGameState([0, 1]);
    state = withTokenProgress(state, 0, "red-0", 53);
    state = withTokenProgress(state, 0, "red-1", 10);

    const legalMoves = [
      { tokenId: "red-0", kind: "advance" as const, toProgress: 56 },
      { tokenId: "red-1", kind: "advance" as const, toProgress: 13 },
    ];
    const chosen = chooseBotMove(state, 0, legalMoves);
    expect(chosen.tokenId).toBe("red-0");
  });

  it("falls back to the single legal move", () => {
    const state = createInitialGameState([0, 1]);
    const legalMoves = [{ tokenId: "red-0", kind: "release" as const, toProgress: 0 }];
    expect(chooseBotMove(state, 0, legalMoves).tokenId).toBe("red-0");
  });
});

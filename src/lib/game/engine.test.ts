import { describe, expect, it } from "vitest";
import {
  applyMove,
  createInitialGameState,
  getLegalMoves,
  removePlayer,
  startTurnRoll,
} from "./engine";
import { FINISH_PROGRESS, LAST_MAIN_PATH_PROGRESS, START_OFFSET } from "./config";
import { IllegalActionError } from "./types";

describe("createInitialGameState", () => {
  it("creates players in ascending seat order with 4 yard tokens each", () => {
    const state = createInitialGameState([0, 2]);
    expect(state.turnOrder).toEqual([0, 2]);
    expect(state.players).toHaveLength(2);
    for (const p of state.players) {
      expect(p.tokens).toHaveLength(4);
      expect(p.tokens.every((t) => t.status === "yard")).toBe(true);
    }
  });

  it("rejects fewer than 2 or more than 4 seats", () => {
    expect(() => createInitialGameState([0])).toThrow(IllegalActionError);
    expect(() => createInitialGameState([0, 1, 2, 3, 0 as never])).toThrow();
  });
});

describe("getLegalMoves", () => {
  it("only allows releasing a yard token on a six", () => {
    const state = createInitialGameState([0, 1]);
    expect(getLegalMoves(state, 0, 5)).toEqual([]);
    const moves = getLegalMoves(state, 0, 6);
    expect(moves).toHaveLength(4);
    expect(moves.every((m) => m.kind === "release")).toBe(true);
  });

  it("rejects moves from a seat that is not the current turn", () => {
    const state = createInitialGameState([0, 1]);
    expect(getLegalMoves(state, 1, 6)).toEqual([]);
  });

  it("disallows advancing a token past the finish cell", () => {
    let state = createInitialGameState([0, 1]);
    state = withTokenProgress(state, 0, "red-0", FINISH_PROGRESS - 2);
    const moves = getLegalMoves(state, 0, 5);
    expect(moves.find((m) => m.tokenId === "red-0")).toBeUndefined();
    const okMoves = getLegalMoves(state, 0, 2);
    expect(okMoves.find((m) => m.tokenId === "red-0")?.toProgress).toBe(
      FINISH_PROGRESS,
    );
  });
});

describe("startTurnRoll", () => {
  it("auto-skips the turn when there are no legal moves", () => {
    const state = createInitialGameState([0, 1]);
    const outcome = startTurnRoll(state, 0, 3); // no 6, nothing in yard can move
    expect(outcome.autoSkipped).toBe(true);
    expect(outcome.legalMoves).toEqual([]);
    expect(outcome.state.currentTurnIndex).toBe(1);
    expect(outcome.state.pendingRoll).toBeNull();
  });

  it("sets pendingRoll when a legal move exists", () => {
    const state = createInitialGameState([0, 1]);
    const outcome = startTurnRoll(state, 0, 6);
    expect(outcome.autoSkipped).toBe(false);
    expect(outcome.state.pendingRoll).toBe(6);
  });

  it("throws if rolling again before resolving the pending roll", () => {
    const state = createInitialGameState([0, 1]);
    const outcome = startTurnRoll(state, 0, 6);
    expect(() => startTurnRoll(outcome.state, 0, 6)).toThrow(IllegalActionError);
  });

  it("throws when the wrong seat tries to roll", () => {
    const state = createInitialGameState([0, 1]);
    expect(() => startTurnRoll(state, 1, 6)).toThrow(IllegalActionError);
  });
});

describe("applyMove", () => {
  it("releases a token from the yard on a six", () => {
    const state = createInitialGameState([0, 1]);
    const rolled = startTurnRoll(state, 0, 6);
    const { state: next, events } = applyMove(rolled.state, 0, "red-0", 6);
    const token = next.players[0].tokens.find((t) => t.id === "red-0")!;
    expect(token.status).toBe("active");
    expect(token.progress).toBe(0);
    expect(events[0]).toMatchObject({ type: "released" });
    // six grants an extra roll: still seat 0's turn
    expect(next.turnOrder[next.currentTurnIndex]).toBe(0);
    expect(next.pendingRoll).toBeNull();
  });

  it("passes the turn after a non-six move", () => {
    let state = createInitialGameState([0, 1]);
    state = withTokenProgress(state, 0, "red-0", 10);
    const rolled = startTurnRoll(state, 0, 4);
    const { state: next } = applyMove(rolled.state, 0, "red-0", 4);
    expect(next.turnOrder[next.currentTurnIndex]).toBe(1);
  });

  it("rejects a move for a token not among the legal set", () => {
    const state = createInitialGameState([0, 1]);
    const rolled = startTurnRoll(state, 0, 6);
    expect(() => applyMove(rolled.state, 0, "green-0", 6)).toThrow(
      IllegalActionError,
    );
  });

  it("rejects a move when the seat does not match the current turn", () => {
    const state = createInitialGameState([0, 1]);
    const rolled = startTurnRoll(state, 0, 6);
    expect(() => applyMove(rolled.state, 1, "green-0", 6)).toThrow(
      IllegalActionError,
    );
  });

  it("captures an opponent token on a non-safe shared square", () => {
    let state = createInitialGameState([0, 1]);
    // red start offset 0; green start offset 13. Put green token 3 cells
    // ahead of red's start-relative progress such that red lands on it.
    // Red progress 11 -> absolute cell 11 (not a safe square).
    state = withTokenProgress(state, 1, "green-0", (11 - START_OFFSET.green + 52) % 52);
    state = withTokenProgress(state, 0, "red-0", 7);
    const rolled = startTurnRoll(state, 0, 4); // red-0: 7 -> 11
    const { state: next, events } = applyMove(rolled.state, 0, "red-0", 4);
    const captured = next.players[1].tokens.find((t) => t.id === "green-0")!;
    expect(captured.status).toBe("yard");
    expect(captured.progress).toBeUndefined();
    expect(events.some((e) => e.type === "captured")).toBe(true);
  });

  it("does not capture on a safe square", () => {
    let state = createInitialGameState([0, 1]);
    // Green's start square (absolute cell 13) is safe. Put green-0 there
    // and move red onto cell 13 as well.
    state = withTokenProgress(state, 1, "green-0", 0); // green-0 at its own start, cell 13
    state = withTokenProgress(state, 0, "red-0", 9);
    const rolled = startTurnRoll(state, 0, 4); // red-0: 9 -> 13 (absolute cell 13)
    const { state: next, events } = applyMove(rolled.state, 0, "red-0", 4);
    const green0 = next.players[1].tokens.find((t) => t.id === "green-0")!;
    expect(green0.status).toBe("active");
    expect(events.some((e) => e.type === "captured")).toBe(false);
  });

  it("requires an exact roll to finish and declares a winner at 4 finished tokens", () => {
    const state = createInitialGameState([0, 1]);
    const player0 = state.players.find((p) => p.seatIndex === 0)!;
    for (const token of player0.tokens) {
      token.status = "finished";
    }
    const last = player0.tokens[0];
    last.status = "active";
    last.progress = FINISH_PROGRESS - 3;

    const overshoot = getLegalMoves(state, 0, 6);
    expect(overshoot.find((m) => m.tokenId === last.id)).toBeUndefined();

    const rolled = startTurnRoll(state, 0, 3);
    const { state: next, events } = applyMove(rolled.state, 0, last.id, 3);
    expect(next.status).toBe("finished");
    expect(next.winnerSeatIndex).toBe(0);
    expect(events.some((e) => e.type === "won")).toBe(true);
  });
});

describe("removePlayer", () => {
  it("drops the seat's players and tokens, keeping the other turns intact", () => {
    const state = createInitialGameState([0, 1, 2]);
    const { state: next, events } = removePlayer(state, 1);
    expect(next.players.map((p) => p.seatIndex)).toEqual([0, 2]);
    expect(next.turnOrder).toEqual([0, 2]);
    expect(next.currentTurnIndex).toBe(0); // seat 0 still has the turn
    expect(events.some((e) => e.type === "player-removed")).toBe(true);
  });

  it("advances the turn when the removed seat currently held it", () => {
    let state = createInitialGameState([0, 1, 2]);
    state = { ...state, currentTurnIndex: 1 }; // seat 1's turn
    const { state: next } = removePlayer(state, 1);
    expect(next.turnOrder).toEqual([0, 2]);
    expect(next.turnOrder[next.currentTurnIndex]).toBe(2); // next after seat 1 was seat 2
    expect(next.pendingRoll).toBeNull();
  });

  it("declares the last remaining player the winner", () => {
    const state = createInitialGameState([0, 1]);
    const { state: next, events } = removePlayer(state, 1);
    expect(next.status).toBe("finished");
    expect(next.winnerSeatIndex).toBe(0);
    expect(events.some((e) => e.type === "won")).toBe(true);
  });

  it("rejects removing a seat that isn't in the game", () => {
    const state = createInitialGameState([0, 1]);
    expect(() => removePlayer(state, 2)).toThrow(IllegalActionError);
  });
});

describe("absolute path consistency", () => {
  it("keeps the last main-path step one below FINISH_PROGRESS minus the home stretch", () => {
    expect(LAST_MAIN_PATH_PROGRESS).toBe(50);
    expect(FINISH_PROGRESS).toBe(56);
  });
});

/** Test helper: force a token's progress without going through dice rolls. */
function withTokenProgress(
  state: ReturnType<typeof createInitialGameState>,
  seatIndex: number,
  tokenId: string,
  progress: number,
) {
  const players = state.players.map((p) => {
    if (p.seatIndex !== seatIndex) return p;
    return {
      ...p,
      tokens: p.tokens.map((t) =>
        t.id === tokenId ? { ...t, status: "active" as const, progress } : t,
      ),
    };
  });
  return { ...state, players };
}

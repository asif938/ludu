"use client";

import { useMemo } from "react";
import { COLOR_ORDER } from "@/lib/game/config";
import type { GameState, TokenState } from "@/lib/game/types";
import {
  ABSOLUTE_PATH_COORDS,
  GRID_SIZE,
  HOME_STRETCH_COORDS,
  starCoordinates,
  tokenCoordinate,
  YARD_BOUNDS,
} from "@/lib/ui/boardLayout";
import { PLAYER_COLOR_STYLES } from "@/lib/ui/playerColors";

const STARS = starCoordinates();

interface PositionedToken {
  token: TokenState;
  x: number;
  y: number;
}

export function Board({
  gameState,
  legalTokenIds,
  myTokenIds,
  onTokenClick,
}: {
  gameState: GameState;
  legalTokenIds: string[];
  myTokenIds: Set<string>;
  onTokenClick: (tokenId: string) => void;
}) {
  const positioned = useMemo<PositionedToken[]>(() => {
    const allTokens = gameState.players.flatMap((p) => p.tokens);
    const groups = new Map<string, TokenState[]>();
    for (const token of allTokens) {
      const [row, col] = tokenCoordinate(token);
      const key = `${row},${col}`;
      const list = groups.get(key) ?? [];
      list.push(token);
      groups.set(key, list);
    }

    const STACK_OFFSETS = [
      [0, 0],
      [0.26, 0],
      [0, 0.26],
      [0.26, 0.26],
    ];

    const result: PositionedToken[] = [];
    for (const list of groups.values()) {
      list.forEach((token, i) => {
        const [row, col] = tokenCoordinate(token);
        const [ox, oy] = list.length > 1 ? STACK_OFFSETS[i % 4] : [0.11, 0.11];
        result.push({ token, x: col + ox, y: row + oy });
      });
    }
    return result;
  }, [gameState]);

  return (
    <svg
      viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}
      className="aspect-square w-full min-w-0 flex-1 touch-none select-none rounded-xl border bg-card shadow-sm lg:max-w-[760px]"
      role="img"
      aria-label="Ludo board"
    >
      <rect x={0} y={0} width={GRID_SIZE} height={GRID_SIZE} className="fill-muted" />

      {/* Yards */}
      {COLOR_ORDER.map((color) => {
        const bounds = YARD_BOUNDS[color];
        const style = PLAYER_COLOR_STYLES[color];
        return (
          <g key={color}>
            <rect
              x={bounds.col}
              y={bounds.row}
              width={6}
              height={6}
              rx={0.6}
              fill={style.hex}
              opacity={0.16}
            />
            <rect
              x={bounds.col + 0.6}
              y={bounds.row + 0.6}
              width={4.8}
              height={4.8}
              rx={0.5}
              className="fill-card"
              stroke={style.hex}
              strokeWidth={0.06}
            />
          </g>
        );
      })}

      {/* Home stretches */}
      {COLOR_ORDER.map((color) =>
        HOME_STRETCH_COORDS[color].map(([row, col], i) => (
          <rect
            key={`${color}-home-${i}`}
            x={col}
            y={row}
            width={1}
            height={1}
            fill={PLAYER_COLOR_STYLES[color].hex}
            opacity={0.3}
            stroke="white"
            strokeWidth={0.02}
          />
        )),
      )}

      {/* Shared path cells */}
      {ABSOLUTE_PATH_COORDS.map(([row, col], i) => (
        <rect
          key={`path-${i}`}
          x={col}
          y={row}
          width={1}
          height={1}
          className="fill-card"
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={0.02}
        />
      ))}

      {/* Safe-square stars */}
      {STARS.map(([row, col], i) => (
        <text
          key={`star-${i}`}
          x={col + 0.5}
          y={row + 0.68}
          textAnchor="middle"
          fontSize={0.55}
          className="fill-muted-foreground select-none"
        >
          ★
        </text>
      ))}

      {/* Center decoration: four triangles pointing inward */}
      <g>
        <polygon points="6,6 9,6 7.5,7.5" fill={PLAYER_COLOR_STYLES.green.hex} />
        <polygon points="9,6 9,9 7.5,7.5" fill={PLAYER_COLOR_STYLES.yellow.hex} />
        <polygon points="9,9 6,9 7.5,7.5" fill={PLAYER_COLOR_STYLES.blue.hex} />
        <polygon points="6,9 6,6 7.5,7.5" fill={PLAYER_COLOR_STYLES.red.hex} />
      </g>

      {/* Tokens */}
      {positioned.map(({ token, x, y }) => {
        const isLegal = legalTokenIds.includes(token.id);
        const isMine = myTokenIds.has(token.id);
        const clickable = isLegal && isMine;
        return (
          <g
            key={token.id}
            style={{ transform: `translate(${x}px, ${y}px)` }}
            className="transition-transform duration-300 ease-out motion-reduce:transition-none"
          >
            {isLegal && isMine && (
              <circle
                cx={0.5}
                cy={0.5}
                r={0.52}
                fill="none"
                stroke={PLAYER_COLOR_STYLES[token.color].hex}
                strokeWidth={0.09}
                className="motion-safe:animate-pulse"
              />
            )}
            {clickable && (
              // Invisible, larger-than-the-dot hit area so the token stays
              // easy to tap on small screens without the visual dot
              // overlapping its neighbors too much.
              <circle cx={0.5} cy={0.5} r={0.5} fill="transparent" className="cursor-pointer" onClick={() => onTokenClick(token.id)} />
            )}
            <circle
              cx={0.5}
              cy={0.5}
              r={0.4}
              fill={PLAYER_COLOR_STYLES[token.color].hex}
              stroke="white"
              strokeWidth={0.07}
              className={clickable ? "pointer-events-none" : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}

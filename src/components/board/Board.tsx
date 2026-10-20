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

interface StackSlot {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  dotRadius: number;
}

/**
 * Compact, non-overlapping layouts for a cell shared by 2+ tokens. Each
 * slot's hit rect (hw/hh, half-width/half-height) tiles the cell without
 * touching its neighbors', so two stacked tokens can never block each
 * other's taps regardless of z-order.
 */
const STACK_SLOTS: Record<2 | 4, StackSlot[]> = {
  2: [
    { cx: 0.29, cy: 0.5, hw: 0.2, hh: 0.46, dotRadius: 0.19 },
    { cx: 0.71, cy: 0.5, hw: 0.2, hh: 0.46, dotRadius: 0.19 },
  ],
  4: [
    { cx: 0.29, cy: 0.29, hw: 0.2, hh: 0.2, dotRadius: 0.17 },
    { cx: 0.71, cy: 0.29, hw: 0.2, hh: 0.2, dotRadius: 0.17 },
    { cx: 0.29, cy: 0.71, hw: 0.2, hh: 0.2, dotRadius: 0.17 },
    { cx: 0.71, cy: 0.71, hw: 0.2, hh: 0.2, dotRadius: 0.17 },
  ],
};

type HitArea = { shape: "circle"; r: number } | { shape: "rect"; hw: number; hh: number };

interface PositionedToken {
  token: TokenState;
  x: number;
  y: number;
  dotRadius: number;
  hit: HitArea;
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

    const result: PositionedToken[] = [];
    for (const list of groups.values()) {
      const n = list.length;
      list.forEach((token, i) => {
        const [row, col] = tokenCoordinate(token);
        if (n <= 1) {
          result.push({
            token,
            x: col,
            y: row,
            dotRadius: 0.4,
            hit: { shape: "circle", r: 0.5 },
          });
          return;
        }
        const slots = STACK_SLOTS[n === 2 ? 2 : 4];
        const slot = slots[i % slots.length];
        result.push({
          token,
          x: col + slot.cx - 0.5,
          y: row + slot.cy - 0.5,
          dotRadius: slot.dotRadius,
          hit: { shape: "rect", hw: slot.hw, hh: slot.hh },
        });
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
      {positioned.map(({ token, x, y, dotRadius, hit }) => {
        const isLegal = legalTokenIds.includes(token.id);
        const isMine = myTokenIds.has(token.id);
        const clickable = isLegal && isMine;
        const compact = dotRadius < 0.35;
        const ringRadius = dotRadius + (compact ? 0.08 : 0.12);
        return (
          <g
            key={token.id}
            style={{ transform: `translate(${x}px, ${y}px)` }}
            className="transition-transform duration-300 ease-out motion-reduce:transition-none"
          >
            {clickable && (
              <circle
                cx={0.5}
                cy={0.5}
                r={ringRadius}
                fill="none"
                stroke={PLAYER_COLOR_STYLES[token.color].hex}
                strokeWidth={compact ? 0.05 : 0.09}
                className="pointer-events-none motion-safe:animate-pulse"
              />
            )}
            {clickable &&
              // Each clickable token's hit area is sized to its own stacked
              // slot (never bigger), so overlapping tokens can't steal each
              // other's taps regardless of draw order.
              (hit.shape === "circle" ? (
                <circle
                  cx={0.5}
                  cy={0.5}
                  r={hit.r}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onTokenClick(token.id)}
                />
              ) : (
                <rect
                  x={0.5 - hit.hw}
                  y={0.5 - hit.hh}
                  width={hit.hw * 2}
                  height={hit.hh * 2}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onTokenClick(token.id)}
                />
              ))}
            <circle
              cx={0.5}
              cy={0.5}
              r={dotRadius}
              fill={PLAYER_COLOR_STYLES[token.color].hex}
              stroke="white"
              strokeWidth={compact ? 0.045 : 0.07}
              // Always non-interactive: a solid-filled token drawn on top of
              // a stacked neighbor must never swallow that neighbor's click,
              // whether or not this token itself is selectable.
              className="pointer-events-none"
            />
          </g>
        );
      })}
    </svg>
  );
}

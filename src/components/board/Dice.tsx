"use client";

import { Button } from "@/components/ui/button";

const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [25, 25],
    [75, 75],
  ],
  3: [
    [25, 25],
    [50, 50],
    [75, 75],
  ],
  4: [
    [25, 25],
    [75, 25],
    [25, 75],
    [75, 75],
  ],
  5: [
    [25, 25],
    [75, 25],
    [50, 50],
    [25, 75],
    [75, 75],
  ],
  6: [
    [25, 25],
    [75, 25],
    [25, 50],
    [75, 50],
    [25, 75],
    [75, 75],
  ],
};

export function Dice({
  value,
  rollNonce,
  canRoll,
  onRoll,
  compact = false,
}: {
  value: number | null;
  /** Changes on every roll (even if the value repeats) so the pop
   * animation can replay via a React key remount instead of effect state. */
  rollNonce: number;
  canRoll: boolean;
  onRoll: () => void;
  /** Smaller die, no secondary "Roll dice" button — used where space is
   * tight, like the small-screen corner-anchored dice. */
  compact?: boolean;
}) {
  const buttonSize = compact ? "size-11" : "size-16";
  const svgSize = compact ? "size-8" : "size-12";

  return (
    <div className={`flex flex-col items-center gap-2 ${compact ? "" : "lg:flex-row lg:gap-3"}`}>
      <button
        type="button"
        onClick={onRoll}
        disabled={!canRoll}
        aria-label={value ? `Dice shows ${value}` : "Roll the dice"}
        className={`flex ${buttonSize} items-center justify-center rounded-xl border-2 bg-card shadow-sm transition-transform motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 ${
          canRoll ? "cursor-pointer border-primary hover:scale-105" : "border-border"
        }`}
      >
        <svg
          key={rollNonce}
          viewBox="0 0 100 100"
          className={`${svgSize} motion-safe:[animation:dice-pop_320ms_ease]`}
        >
          {value !== null &&
            DOT_POSITIONS[value].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r={9} className="fill-foreground" />
            ))}
          {value === null && (
            <text x={50} y={62} textAnchor="middle" fontSize={34} className="fill-muted-foreground">
              ?
            </text>
          )}
        </svg>
      </button>
      {!compact && (
        <Button size="sm" variant={canRoll ? "default" : "outline"} disabled={!canRoll} onClick={onRoll}>
          Roll dice
        </Button>
      )}
    </div>
  );
}

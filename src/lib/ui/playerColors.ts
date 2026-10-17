import type { PlayerColor } from "@/lib/game/types";

interface ColorStyle {
  /** Tailwind background class for solid chips/tokens. */
  bg: string;
  /** Tailwind text class for labels. */
  text: string;
  /** Tailwind border class. */
  border: string;
  /** Raw hex, for inline SVG fills where Tailwind classes don't apply. */
  hex: string;
  label: string;
}

export const PLAYER_COLOR_STYLES: Record<PlayerColor, ColorStyle> = {
  red: {
    bg: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500",
    hex: "#ef4444",
    label: "Red",
  },
  green: {
    bg: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500",
    hex: "#10b981",
    label: "Green",
  },
  yellow: {
    bg: "bg-amber-400",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-400",
    hex: "#fbbf24",
    label: "Yellow",
  },
  blue: {
    bg: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500",
    hex: "#3b82f6",
    label: "Blue",
  },
};

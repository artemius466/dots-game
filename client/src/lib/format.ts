import { PLAYER_COLORS } from "../constants";
import type { PlayerColor } from "../constants";

// Color palette keyed by player color name.
export const COLOR_HEX: Record<PlayerColor, string> = {
  Red: "#EF4444",
  Blue: "#3B82F6",
  Green: "#22C55E",
  Yellow: "#EAB308",
};

// Format milliseconds as mm:ss (leading zero on minutes under 10).
export function TIME_FORMAT_MS(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `${mm}:${ss}`;
}

export const colorNames = PLAYER_COLORS as readonly string[];

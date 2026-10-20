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

// --- Colour helpers (for bead gradients, translucent territory fills, etc.) ---

// Parse a "#RRGGBB" or "#RGB" hex into 8-bit channels.
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const int = parseInt(h, 16) || 0;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

// A hex colour with an explicit alpha channel.
export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Shift a hex colour toward white (positive pct) or black (negative pct).
export function shade(hex: string, pct: number): string {
  const { r, g, b } = hexToRgb(hex);
  const to = Math.round(pct >= 0 ? 255 + (r - 255) * pct : r * (1 + pct));
  const gg = Math.round(pct >= 0 ? 255 + (g - 255) * pct : g * (1 + pct));
  const bb = Math.round(pct >= 0 ? 255 + (b - 255) * pct : b * (1 + pct));
  return `#${(0x1000000 | (to << 16) | (gg << 8) | bb).toString(16).slice(1)}`;
}

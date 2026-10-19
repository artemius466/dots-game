// Client-side constants, mirroring the server's values in server/src/types.ts.

export const PLAYER_COLORS = ["Red", "Blue", "Green", "Yellow"] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

// Board grid options offered in the room config (must match ALLOWED_GRIDS).
export const GRID_OPTIONS: { rows: number; cols: number; label: string }[] = [
  { rows: 20, cols: 20, label: "20 × 20" },
  { rows: 30, cols: 30, label: "30 × 30" },
  { rows: 39, cols: 32, label: "39 × 32" },
];

export const MODE_OPTIONS: { mode: "20" | "all"; modeLabel: "20 dots" | "All grid" }[] = [
  { mode: "20", modeLabel: "20 dots" },
  { mode: "all", modeLabel: "All grid" },
];

export const MAX_PLAYERS = 4;
export const TURN_TIME_MS = 60_000;

// Room code alphabet (matches CODE_ALPHABET on the server).
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

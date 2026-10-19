export const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
export const TURN_TIME_MS = 60_000;
export const ALLOWED_GRIDS = [
  { rows: 20, cols: 20 },
  { rows: 30, cols: 30 },
  { rows: 39, cols: 32 },
] as const;
export const MAX_PLAYERS = 4;
export const WINNING_SCORE_20 = 20;

export type GridSize = { rows: number; cols: number };
export type GameMode = "20" | "all";
export type GameModeKey = "20 dots" | "All grid";

export const PLAYER_COLORS = ["Red", "Blue", "Green", "Yellow"] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export interface Point {
  r: number;
  c: number;
}

export interface Dot {
  r: number;
  c: number;
  ownerId: string;
  isAlive: boolean;
  capturedBy: string | null;
}

export interface Intersection {
  r: number;
  c: number;
  locked: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  connected: boolean;
  score: number;
}

export interface RoomConfig {
  maxPlayers: number;
  grid: GridSize;
  mode: GameMode;
  modeLabel: GameModeKey;
}

export interface Room {
  code: string;
  config: RoomConfig;
  players: Player[];
  dots: Dot[];
  intersections: Intersection[];
  activePlayerId: string | null;
  turnStartedAt: number;
  winnerId: string | null;
  gameOver: boolean;
  turnSkipCount: number;
}

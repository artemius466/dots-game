import { COLOR_HEX } from "./lib/format";
import { PLAYER_COLORS } from "./constants";
import type { PlayerColor } from "./constants";

// These mirror the server's serialized room shape (see server/src/socketService.ts).

export interface RoomConfig {
  maxPlayers: number;
  grid: { rows: number; cols: number };
  mode: "20" | "all";
  modeLabel: "20 dots" | "All grid";
}

export interface ServerPlayer {
  id: string;
  name: string;
  color: PlayerColor;
  connected: boolean;
  score: number;
  disconnected?: boolean;
}

export interface ServerDot {
  r: number;
  c: number;
  ownerId: string;
  isAlive: boolean;
  capturedBy: string | null;
}

export interface ServerIntersection {
  r: number;
  c: number;
  locked: boolean;
}

export interface SerializedRoom {
  code: string;
  config: RoomConfig;
  players: ServerPlayer[];
  dots: ServerDot[];
  intersections: ServerIntersection[];
  activePlayerId: string | null;
  winnerId: string | null;
  gameOver: boolean;
}

export interface GameOverInfo {
  winner: { id: string; name: string; color: PlayerColor } | null;
  players: {
    id: string;
    name: string;
    color: PlayerColor;
    score: number;
    disconnected: boolean;
  }[];
  mode: string;
}

// The player's own seat, returned once a room is joined.
export interface MyPlayer {
  id: string;
  name: string;
  color: PlayerColor;
  connected: boolean;
  score: number;
}

export const playerColorHex = (color: PlayerColor): string => COLOR_HEX[color];

// Helper: look up a player's color by id from the player list.
export function colorForId(players: ServerPlayer[], id: string): PlayerColor | undefined {
  return players.find((p) => p.id === id)?.color;
}

export const colorNames = PLAYER_COLORS as readonly string[];

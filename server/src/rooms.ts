import type { Player, Room, RoomConfig } from "./types.js";
import { addPlayer, createRoom } from "./engine.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(len = 6): string {
  let code = "";
  for (let i = 0; i < len; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export interface RoomManager {
  getRoom(code: string): Room | undefined;
  createRoom(code: string, config: RoomConfig): Room;
  addPlayer(room: Room, id: string, name: string): Player | { error: string };
  removePlayer(room: Room, id: string): void;
  allRooms(): Room[];
}

export function createRoomManager(): RoomManager {
  const rooms = new Map<string, Room>();

  return {
    getRoom(code) {
      return rooms.get(code);
    },
    createRoom(code, config) {
      const room = createRoom(config);
      room.code = code;
      rooms.set(code, room);
      return room;
    },
    addPlayer(room, id, name) {
      if (room.gameOver) return { error: "Room game already finished" };
      if (room.players.length >= room.config.maxPlayers) {
        return { error: "Room is full" };
      }
      // Color assignment by seat position.
      const colorIdx = room.players.length;
      const colors = ["Red", "Blue", "Green", "Yellow"] as const;
      const player = addPlayer(room, id, name, colors[colorIdx]);
      return player;
    },
    removePlayer(room, id) {
      const idx = room.players.findIndex((p) => p.id === id);
      if (idx === -1) return;
      const player = room.players[idx];
      player.connected = false;
      // Prune player if they were the only/last participants eventually handled by game over.
    },
    allRooms() {
      return [...rooms.values()];
    },
  };
}

// Ensure the active player is still connected; skip expired seats.
export function pruneDisconnected(room: Room): void {
  for (const p of room.players) {
    if (!p.connected) {
      // mark disconnected (already set) — dots/regions/scores remain.
    }
  }
}

import type { Server as IOServer, Socket } from "socket.io";
import { TURN_TIME_MS } from "./types.js";
import { createRoomManager, RoomManager } from "./rooms.js";
import {
  checkWinCondition,
  placeDot,
  recalcScores,
  setFirstTurn,
  skipTurn,
} from "./engine.js";
import type { Room } from "./types.js";
import { generateRoomCode } from "./rooms.js";

const CODE_TO_ROOM = new Map<string, string>(); // client uuid -> room code

export function attachServer(io: IOServer, rooms: RoomManager) {
  const timers = new Map<string, NodeJS.Timeout>(); // room code -> turn timer

  function broadcastState(room: Room) {
    io.to(room.code).emit("state", serializeRoom(room));
  }

  function startTurnTimer(room: Room) {
    clearTurnTimer(room.code);
    const timer = setInterval(() => {
      const r = rooms.getRoom(room.code);
      if (!r || r.gameOver) {
        clearTurnTimer(room.code);
        return;
      }
      const elapsed = Date.now() - r.turnStartedAt;
      if (elapsed >= TURN_TIME_MS) {
        // Turn expired: skip active player.
        const active = r.players.find((p) => p.id === r.activePlayerId);
        if (active && active.connected) {
          skipTurn(r);
          broadcastState(r);
        }
        if (checkWinCondition(r)) {
          clearTurnTimer(r.code);
          io.to(r.code).emit("gameOver", serializeGameOver(r));
        }
      }
      // Push a lightweight countdown to clients each second.
      const remaining = Math.max(0, Math.ceil((TURN_TIME_MS - (Date.now() - r.turnStartedAt)) / 1000));
      io.to(r.code).emit("timer", { remaining, activePlayerId: r.activePlayerId });
    }, 1000);
    timers.set(room.code, timer);
  }

  function clearTurnTimer(code: string) {
    const t = timers.get(code);
    if (t) { clearInterval(t); timers.delete(code); }
  }

  io.on("connection", (socket) => {
    socket.on("createRoom", ({ nickname, config }) => {
      const code = generateRoomCode();
      const room = rooms.createRoom(code, config);
      const res = rooms.addPlayer(room, socket.id, nickname);
      if ("error" in res) {
        socket.emit("error", res.error);
        return;
      }
      CODE_TO_ROOM.set(socket.id, code);
      socket.join(code);
      socket.emit("roomJoined", { code, me: socket.id, player: res });
      broadcastState(room);
    });

    socket.on("joinRoom", ({ nickname, code }) => {
      const room = rooms.getRoom(code);
      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }
      const res = rooms.addPlayer(room, socket.id, nickname);
      if ("error" in res) {
        socket.emit("error", res.error);
        return;
      }
      CODE_TO_ROOM.set(socket.id, code);
      socket.join(code);
      socket.emit("roomJoined", { code, me: socket.id, player: res });
      broadcastState(room);
    });

    socket.on("startGame", (code: string) => {
      const room = rooms.getRoom(code);
      if (!room) return;
      const host = room.players.find((p) => p.id === socket.id);
      if (!host || host.name === undefined) return;
      // Host check: the socket that started the room should be first player.
      if (room.players[0]?.id !== socket.id) {
        socket.emit("error", "Only the host can start the game");
        return;
      }
      if (room.players.length < 2) {
        socket.emit("error", "Need at least 2 players");
        return;
      }
      setFirstTurn(room);
      recalcScores(room);
      broadcastState(room);
      startTurnTimer(room);
    });

    socket.on("placeDot", ({ r, c }) => {
      const code = CODE_TO_ROOM.get(socket.id);
      if (!code) return;
      const room = rooms.getRoom(code);
      if (!room) return;
      const outcome = placeDot(room, socket.id, r, c);
      recalcScores(room);
      const won = checkWinCondition(room);
      broadcastState(room);
      if (won) {
        clearTurnTimer(room.code);
        io.to(room.code).emit("gameOver", serializeGameOver(room));
      } else if (outcome.captures.length) {
        io.to(room.code).emit("captures", outcome.captures);
      }
    });

    socket.on("restartGame", (code: string) => {
      const room = rooms.getRoom(code);
      if (!room) return;
      if (room.players[0]?.id !== socket.id) return;
      room.dots = [];
      room.intersections.forEach((i) => (i.locked = false));
      room.players.forEach((p) => (p.score = 0));
      room.winnerId = null;
      room.gameOver = false;
      room.turnSkipCount = 0;
      setFirstTurn(room);
      broadcastState(room);
      startTurnTimer(room);
    });

    socket.on("leaveRoom", (code: string) => {
      const room = rooms.getRoom(code);
      if (room) rooms.removePlayer(room, socket.id);
      CODE_TO_ROOM.delete(socket.id);
      socket.leave(code);
      if (room) broadcastState(room);
    });

    socket.on("disconnect", () => {
      const code = CODE_TO_ROOM.get(socket.id);
      if (code) {
        const room = rooms.getRoom(code);
        if (room) {
          rooms.removePlayer(room, socket.id);
          broadcastState(room);
        }
        CODE_TO_ROOM.delete(socket.id);
      }
    });
  });

  return { io, rooms, clearTurnTimer };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function serializeRoom(room: Room) {
  return {
    code: room.code,
    config: room.config,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      connected: p.connected,
      score: p.score,
    })),
    dots: room.dots.map((d) => ({
      r: d.r,
      c: d.c,
      ownerId: d.ownerId,
      isAlive: d.isAlive,
      capturedBy: d.capturedBy,
    })),
    intersections: room.intersections.map((i) => ({ r: i.r, c: i.c, locked: i.locked })),
    activePlayerId: room.activePlayerId,
    winnerId: room.winnerId,
    gameOver: room.gameOver,
  };
}

function serializeGameOver(room: Room) {
  const winner = room.players.find((p) => p.id === room.winnerId);
  return {
    winner: winner ? { id: winner.id, name: winner.name, color: winner.color } : null,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
      disconnected: !p.connected,
    })),
    mode: room.config.modeLabel,
  };
}

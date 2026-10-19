import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import cors from "cors";
import { PORT } from "./types.js";
import { createRoomManager } from "./rooms.js";
import { attachServer } from "./socketService.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms = createRoomManager();
attachServer(io, rooms);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", rooms: rooms.allRooms().length });
});

server.listen(PORT, () => {
  console.log(`Dots server listening on http://localhost:${PORT}`);
});

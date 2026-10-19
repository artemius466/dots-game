import { createRoom, addPlayer, placeDot, recalcScores } from "./src/engine.js";

const room = createRoom({ maxPlayers: 2, grid: { rows: 10, cols: 10 }, mode: "all", modeLabel: "All grid" });
addPlayer(room, "A", "Alice", "Red");
addPlayer(room, "B", "Bob", "Blue");

const play = (id: string, r: number, c: number) => { room.activePlayerId = id; return placeDot(room, id, r, c); };

play("B", 4, 4);
console.log("After blue dot, dots:", room.dots.length, "active:", room.activePlayerId);

const RING = [
  [2,2],[2,3],[2,4],[2,5],[2,6],
  [6,2],[6,3],[6,4],[6,5],[6,6],
  [3,2],[4,2],[5,2],
  [3,6],[4,6],[5,6],
];
for (const [r, c] of RING) {
  const res = play("A", r, c);
  console.log(`placed A at ${r},${c} captures: ${res.captures.length}`);
}
recalcScores(room);
console.log("Red score:", room.players.find((p)=>p.id==="A")!.score);
console.log("locked count:", room.intersections.filter(i=>i.locked).length);

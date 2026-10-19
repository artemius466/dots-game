import {
  createRoom,
  addPlayer,
  placeDot,
  recalcScores,
  checkWinCondition,
  setFirstTurn,
} from "./src/engine.js";

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { pass++; console.log("  \u2713", msg); }
  else { fail++; console.log("  \u2717 FAIL:", msg); }
}

// Helper: force the given player to be active, then place a dot.
function play(room: any, id: string, r: number, c: number) {
  room.activePlayerId = id;
  return placeDot(room, id, r, c);
}

const RING = [
  [2,2],[2,3],[2,4],[2,5],[2,6],
  [6,2],[6,3],[6,4],[6,5],[6,6],
  [3,2],[4,2],[5,2],
  [3,6],[4,6],[5,6],
];

// --- Test 1: basic square capture of one interior dot ---
{
  const room = createRoom({ maxPlayers: 2, grid: { rows: 10, cols: 10 }, mode: "all", modeLabel: "All grid" });
  addPlayer(room, "A", "Alice", "Red");
  addPlayer(room, "B", "Bob", "Blue");
  setFirstTurn(room);

  play(room, "B", 4, 4); // interior blue dot
  for (const [r, c] of RING) play(room, "A", r, c);
  recalcScores(room);
  const red = room.players.find((p) => p.id === "A")!.score;
  console.log("Test 1: basic square capture");
  assert(red === 1, `Red captured the 1 interior blue dot (got ${red})`);
}

// --- Test 2: free region does not capture ---
{
  const room = createRoom({ maxPlayers: 2, grid: { rows: 10, cols: 10 }, mode: "all", modeLabel: "All grid" });
  addPlayer(room, "A", "Alice", "Red");
  addPlayer(room, "B", "Bob", "Blue");
  setFirstTurn(room);

  for (const [r, c] of RING) play(room, "A", r, c);
  recalcScores(room);
  const red = room.players.find((p) => p.id === "A")!.score;
  console.log("Test 2: free region no capture");
  assert(red === 0, `Red scores 0 on a free region (got ${red})`);
  assert(room.intersections.every((i) => !i.locked), "No intersections locked in a free region");
}

// --- Test 3: delayed capture (suicidal move) ---
{
  const room = createRoom({ maxPlayers: 2, grid: { rows: 10, cols: 10 }, mode: "all", modeLabel: "All grid" });
  addPlayer(room, "A", "Alice", "Red");
  addPlayer(room, "B", "Bob", "Blue");
  setFirstTurn(room);

  for (const [r, c] of RING) play(room, "A", r, c);
  play(room, "B", 4, 4); // step into free region
  recalcScores(room);
  const red = room.players.find((p) => p.id === "A")!.score;
  const blue = room.players.find((p) => p.id === "B")!.score;
  console.log("Test 3: delayed capture");
  assert(red === 1, `Red captures via delayed move (got ${red})`);
  assert(blue === 0, `Blue scores 0 for own captured dot (got ${blue})`);
}

// --- Test 4: nested capture / score stealing ---
{
  const room = createRoom({ maxPlayers: 3, grid: { rows: 20, cols: 20 }, mode: "all", modeLabel: "All grid" });
  addPlayer(room, "A", "Alice", "Red");
  addPlayer(room, "B", "Bob", "Blue");
  addPlayer(room, "C", "Carol", "Green");
  setFirstTurn(room);

  // Blue builds a small ring and captures Green.
  const smallBlue = [[4,4],[4,5],[4,6],[4,7],[7,4],[7,5],[7,6],[7,7],[5,4],[6,4],[5,7],[6,7]];
  for (const [r,c] of smallBlue) play(room, "B", r, c);
  play(room, "C", 5, 5); // Green steps inside
  recalcScores(room);
  const blueAfter = room.players.find((p) => p.id === "B")!.score;
  console.log("Test 4: nested capture");
  assert(blueAfter === 1, `Blue holds 1 captured dot (got ${blueAfter})`);

  // Red builds a big ring enclosing Blue's whole region.
  const bigRed: [number, number][] = [];
  for (let c = 2; c <= 9; c++) { bigRed.push([2, c]); bigRed.push([9, c]); }
  for (let r = 2; r <= 9; r++) { bigRed.push([r, 2]); bigRed.push([r, 9]); }
  for (const [r,c] of bigRed) play(room, "A", r, c);
  recalcScores(room);
  const redAfter = room.players.find((p) => p.id === "A")!.score;
  const blueAfter2 = room.players.find((p) => p.id === "B")!.score;
  console.log("  (nested) Red big ring");
  assert(redAfter > blueAfter2, `Red's outer loop steals Blue's captured points (Red ${redAfter} > Blue ${blueAfter2})`);
  assert(blueAfter2 === 0, `Blue loses captured points after being overwritten (got ${blueAfter2})`);
}

// --- Test 5: win condition 20 dots ---
{
  const room = createRoom({ maxPlayers: 2, grid: { rows: 30, cols: 30 }, mode: "20", modeLabel: "20 dots" });
  addPlayer(room, "A", "Alice", "Red");
  addPlayer(room, "B", "Bob", "Blue");
  setFirstTurn(room);

  room.players.find((p) => p.id === "A")!.score = 19;
  const won = checkWinCondition(room);
  console.log("Test 5: 20-dots win");
  assert(!won, "Game not over at 19");
  room.players.find((p) => p.id === "A")!.score = 20;
  const won2 = checkWinCondition(room);
  assert(won2 && room.winnerId === "A", "Red wins at 20");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

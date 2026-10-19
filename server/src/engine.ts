import type { Dot, Intersection, Player, Room, RoomConfig } from "./types.js";

const DIRS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

// Orthogonal (4-way) neighbors. Used by the outside flood fill so it cannot
// leak through the diagonal corners of a ring. An 8-connected ring (see
// componentOf) with a 4-way background is a sealed boundary, so an open ring
// like
//   _*_
//   *@*      <- the center is captured
//   *_
// encloses its center even though its diagonal corners are empty.
const DIRS_4 = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];

// ---------------------------------------------------------------------------
// Room & player helpers
// ---------------------------------------------------------------------------

export function createRoom(config: RoomConfig): Room {
  const { rows, cols } = config.grid;
  const dots: Dot[] = [];
  const intersections: Intersection[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      intersections.push({ r, c, locked: false });
    }
  }
  return {
    code: "",
    config,
    players: [],
    dots,
    intersections,
    activePlayerId: null,
    turnStartedAt: 0,
    winnerId: null,
    gameOver: false,
    turnSkipCount: 0,
  };
}

export function addPlayer(room: Room, id: string, name: string, color: Player["color"]): Player {
  const player: Player = { id, name, color, connected: true, score: 0 };
  room.players.push(player);
  return player;
}

export function dotKey(r: number, c: number): string {
  return `${r},${c}`;
}

export function getDotAt(room: Room, r: number, c: number): Dot | undefined {
  return room.dots.find((d) => d.r === r && d.c === c);
}

export function intersectionLocked(room: Room, r: number, c: number): boolean {
  const ix = room.intersections.find((i) => i.r === r && i.c === c);
  return !!ix && ix.locked;
}

// ---------------------------------------------------------------------------
// Core geometry: interior of a region bounded by a set of "wall" cells
// ---------------------------------------------------------------------------
//
// Given a set of wall cells (typically a player's alive dots), compute the set
// of grid cells strictly ENCLOSED by those walls. We flood fill from outside the
// grid (padded border) through every non-wall cell. Any in-grid cell that is NOT
// reached is strictly interior (empty intersections + dead dots + alive opponent
// dots that are trapped).
//
// This single primitive correctly handles:
//  - proper rings (encloses the hollow center),
//  - filled blobs (no enclosed cells -> no capture),
//  - gaps in a ring (flood leaks in from outside -> not enclosed -> no capture),
//  - the edge rule (border padding reaches into border-claimed regions).
function floodInterior(
  room: Room,
  walls: Set<string>,
  rows: number,
  cols: number,
): { interiorKeys: Set<string>; interiorDots: Dot[] } {
  const visited = new Set<string>();
  const frontier: string[] = [];

  // Seed ONLY the padded outside border, then flood inward through non-wall
  // cells. Enclosed in-grid cells will never be reached and thus count as interior.
  // Use the real (possibly negative / out-of-grid) coordinates so the padded
  // border cells' neighbors reach the grid's outer ring; these keys never
  // collide with in-grid keys (which are all "0..rows-1, 0..cols-1").
  for (let r = -1; r <= rows; r++) {
    for (let c = -1; c <= cols; c++) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) {
        const k = dotKey(r, c);
        visited.add(k);
        frontier.push(k);
      }
    }
  }

  while (frontier.length) {
    const [cr, cc] = frontier.shift()!.split(",").map(Number);
    // Expand neighbors; only guard the neighbor coordinates so padded
    // "outside" cells still flood into the grid's border cells. Flood with
    // orthogonal (4-way) moves so an outside cell can never slip through the
    // empty diagonal corners of an 8-connected ring. This is what lets an open
    // ring (diamond) capture, while the classic filled ring keeps capturing too.
    for (const [dr, dc] of DIRS_4) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const nk = dotKey(nr, nc);
      if (visited.has(nk) || walls.has(nk)) continue;
      visited.add(nk);
      frontier.push(nk);
    }
  }

  const interiorKeys = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = dotKey(r, c);
      // Interior = in-grid cells that are walls-enclosed (not reached from outside)
      // but are NOT themselves the ring/loop wall dots.
      if (!visited.has(k) && !walls.has(k)) interiorKeys.add(k);
    }
  }

  const interiorDots: Dot[] = [];
  for (const k of interiorKeys) {
    const [r, c] = k.split(",").map(Number);
    const dot = getDotAt(room, r, c);
    if (dot) interiorDots.push(dot);
  }
  return { interiorKeys, interiorDots };
}

// Connected component (8-adjacency) of alive dots of `owner` containing `startKey`.
function componentOf(room: Room, startKey: string, owner: string): Set<string> {
  const { rows, cols } = room.config.grid;
  const comp = new Set<string>();
  const stack = [startKey];
  comp.add(startKey);
  while (stack.length) {
    const [cr, cc] = stack.pop()!.split(",").map(Number);
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const nk = dotKey(nr, nc);
      if (comp.has(nk)) continue;
      const dot = getDotAt(room, nr, nc);
      if (dot && dot.ownerId === owner && dot.isAlive) {
        comp.add(nk);
        stack.push(nk);
      }
    }
  }
  return comp;
}

// ---------------------------------------------------------------------------
// Move processing
// ---------------------------------------------------------------------------

export interface CaptureOutcome {
  // list of captures applied: owner -> region
  captures: { ownerId: string; interiorKeys: Set<string>; interiorDots: Dot[] }[];
}

export function canPlace(room: Room, r: number, c: number): boolean {
  const { rows, cols } = room.config.grid;
  if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
  if (intersectionLocked(room, r, c)) return false;
  return !getDotAt(room, r, c);
}

// Place a dot for `playerId`, then resolve all captures (own + delayed).
export function placeDot(room: Room, playerId: string, r: number, c: number): CaptureOutcome {
  if (room.gameOver) return { captures: [] };
  if (playerId !== room.activePlayerId) return { captures: [] };
  if (!canPlace(room, r, c)) return { captures: [] };

  const dot: Dot = { r, c, ownerId: playerId, isAlive: true, capturedBy: null };
  room.dots.push(dot);

  const { rows, cols } = room.config.grid;

  // 1) Does this placement close a NEW capture for the placing player?
  const ownComponent = componentOf(room, dotKey(r, c), playerId);
  let ownCapture: { ownerId: string; interiorKeys: Set<string>; interiorDots: Dot[] } | null = null;

  if (ownComponent.size >= 3) {
    const { interiorKeys, interiorDots } = floodInterior(room, ownComponent, rows, cols);
    // A capture requires at least one alive opponent dot strictly inside.
    const hasActiveOpponent = interiorDots.some((d) => d.isAlive && d.ownerId !== playerId);
    if (hasActiveOpponent) {
      ownCapture = { ownerId: playerId, interiorKeys, interiorDots };
    }
  }

  const outcomes: CaptureOutcome["captures"] = [];

  if (ownCapture) {
    // Own move completed a capturing loop -> apply it, skip delayed capture.
    applyCapture(room, ownCapture);
    outcomes.push(ownCapture);
  } else {
    // Own move did NOT close a loop. If the placed dot now sits inside another
    // player's alive free region, that region is converted to a capture for them.
    for (const player of room.players) {
      if (player.id === playerId) continue;
      const walls = new Set<string>();
      for (const d of room.dots) {
        if (d.isAlive && d.ownerId === player.id) walls.add(dotKey(d.r, d.c));
      }
      if (walls.size < 3) continue;
      const { interiorKeys, interiorDots } = floodInterior(room, walls, rows, cols);
      const steppedOn = interiorDots.some((d) => d.r === r && d.c === c && d.ownerId === playerId);
      if (steppedOn) {
        const res = { ownerId: player.id, interiorKeys, interiorDots };
        applyCapture(room, res);
        outcomes.push(res);
      }
    }
  }

  recalcScores(room);

  // Advance the turn regardless of whether a capture happened.
  advanceTurn(room);
  return { captures: outcomes };
}

export function applyCapture(room: Room, cap: { ownerId: string; interiorKeys: Set<string>; interiorDots: Dot[] }): void {
  // 1) Lock all strictly-interior intersections.
  for (const k of cap.interiorKeys) {
    const [r, c] = k.split(",").map(Number);
    const ix = room.intersections.find((i) => i.r === r && i.c === c);
    if (ix) ix.locked = true;
  }
  // 2) Every dot strictly inside becomes dead.
  for (const d of cap.interiorDots) d.isAlive = false;
  // 3) Ownership & nested-loop score stealing.
  for (const d of cap.interiorDots) {
    if (d.ownerId === cap.ownerId) {
      d.capturedBy = null; // own dot stays dead, does not score; any prior capture by another is voided
    } else {
      d.capturedBy = cap.ownerId; // opponent dot now scores for the capturer
    }
  }
}

export function recalcScores(room: Room): void {
  for (const player of room.players) {
    player.score = room.dots.filter((d) => d.capturedBy === player.id).length;
  }
}

// ---------------------------------------------------------------------------
// Turn management
// ---------------------------------------------------------------------------

function activePlayers(room: Room): Player[] {
  return room.players.filter((p) => p.connected);
}

export function advanceTurn(room: Room): void {
  const alive = activePlayers(room);
  if (alive.length === 0) return;

  // Find the next active player cyclically after the current one.
  const order = room.players;
  let idx = order.findIndex((p) => p.id === room.activePlayerId);
  for (let i = 1; i <= order.length; i++) {
    const p = order[(idx + i) % order.length];
    if (p.connected) {
      room.activePlayerId = p.id;
      break;
    }
  }
  room.turnStartedAt = Date.now();
  room.turnSkipCount++;
}

export function setFirstTurn(room: Room): void {
  const first = activePlayers(room)[0];
  if (first) {
    room.activePlayerId = first.id;
    room.turnStartedAt = Date.now();
  }
}

// Turn expiry -> skip active player to next connected player.
export function skipTurn(room: Room): void {
  if (room.gameOver) return;
  advanceTurn(room);
}

// ---------------------------------------------------------------------------
// Win conditions
// ---------------------------------------------------------------------------

export function checkWinCondition(room: Room): boolean {
  if (room.gameOver) return true;
  const { rows, cols } = room.config.grid;

  if (room.config.mode === "20") {
    const winner = room.players.find((p) => p.score >= 20);
    if (winner) {
      room.winnerId = winner.id;
      room.gameOver = true;
      return true;
    }
    return false;
  }

  // "all grid" mode: end when no intersection can ever be used again.
  const total = rows * cols;
  const unusable = room.dots.length + room.intersections.filter((i) => i.locked).length;
  const anyConnected = room.players.some((p) => p.connected);

  if (unusable >= total || !anyConnected) {
    let best = -1;
    for (const p of room.players) if (p.score > best) best = p.score;
    // Handle ties: first player (by color assignment) with the best score.
    room.winnerId = room.players.find((p) => p.score === best)?.id ?? null;
    room.gameOver = true;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Utility: board used for hover preview validity (server-side check)
// ---------------------------------------------------------------------------

export function validateMove(room: Room, playerId: string, r: number, c: number): { ok: boolean; reason?: string } {
  if (room.gameOver) return { ok: false, reason: "Game is over" };
  if (playerId !== room.activePlayerId) return { ok: false, reason: "Not your turn" };
  if (!canPlace(room, r, c)) {
    const hasDot = !!getDotAt(room, r, c);
    return { ok: false, reason: hasDot ? "Intersection already occupied" : "Intersection is locked" };
  }
  return { ok: true };
}

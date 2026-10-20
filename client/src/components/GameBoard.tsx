import { useGameStore } from "../socketContext";
import { COLOR_HEX, TIME_FORMAT_MS, rgba, shade } from "../lib/format";
import {
  BoardLayout,
  computeBoardLayout,
  pointToPixel,
  pixelToPoint,
} from "../lib/geometry";
import { colorForId, playerColorHex, type SerializedRoom, type ServerDot } from "../types";
import type { PlayerColor } from "../constants";
import { useEffect, useRef, useState } from "react";

// Animation timings (ms).
const POP_MS = 220; // new dot scales in
const CAPTURE_MS = 450; // captured dot's expanding pulse
const LAST_MOVE_MS = 500; // "last move" ring fade-out

// --- Territory computation -------------------------------------------------
//
// Mirror the server's flood-fill: treat a player's alive dots as walls, flood
// from the padded outside border inward through non-wall cells, and mark every
// in-grid cell that is never reached (and isn't itself a wall) as that player's
// enclosed territory. This lets us colour captured regions behind the dots
// without owning any extra state from the server.
const DIRS_4 = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
] as const;

function computeTerritories(
  dots: ServerDot[],
  rows: number,
  cols: number,
  colorOf: (id: string) => PlayerColor | undefined,
): Map<string, PlayerColor> {
  const fills = new Map<string, PlayerColor>();
  const wallsByPlayer = new Map<PlayerColor, Set<string>>();
  for (const d of dots) {
    if (!d.isAlive) continue;
    const color = colorOf(d.ownerId);
    if (!color) continue;
    if (!wallsByPlayer.has(color)) wallsByPlayer.set(color, new Set());
    wallsByPlayer.get(color)!.add(`${d.r},${d.c}`);
  }

  for (const [color, walls] of wallsByPlayer) {
    if (walls.size < 3) continue; // a ring needs at least 3 dots to enclose
    const visited = new Set<string>();
    const frontier: [number, number][] = [];
    for (let r = -1; r <= rows; r++) {
      for (let c = -1; c <= cols; c++) {
        if (r < 0 || c < 0 || r >= rows || c >= cols) {
          visited.add(`${r},${c}`);
          frontier.push([r, c]);
        }
      }
    }
    while (frontier.length) {
      const [cr, cc] = frontier.shift()!;
      for (const [dr, dc] of DIRS_4) {
        const nr = cr + dr;
        const nc = cc + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const k = `${nr},${nc}`;
        if (visited.has(k) || walls.has(k)) continue;
        visited.add(k);
        frontier.push([nr, nc]);
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = `${r},${c}`;
        if (!visited.has(k) && !walls.has(k)) fills.set(k, color);
      }
    }
  }
  return fills;
}

// --- Capture flourish --------------------------------------------------------
//
// When a closed loop of a player's dots encloses new cells, those cells become
// territory all at once. We detect that transition per move, derive the
// enclosing loop of that player's dots, and play a one-time flourish: the loop
// is traced radially outward from the completing (last-placed) dot, then the
// region fades in at 25% opacity. Both the outline and the fill then stay
// drawn permanently, reading as that player's region boundaries.

interface CapturedRegion {
  color: PlayerColor;
  cells: Array<[number, number]>; // newly enclosed grid cells
  verts: Array<[number, number]>; // enclosing loop, grid coords, ordered to start at the completing dot
  t0: number; // performance.now() when the flourish began
  traceMs: number; // ms to trace the full loop
  fadeMs: number; // ms for the fill to fade in once the loop is traced
}

interface PersistedRegion {
  color: PlayerColor;
  verts: Array<[number, number]>; // enclosing loop, grid coords, cyclic order
}

// Convex hull (Andrew's monotone chain). Returns the outer points in
// counter-clockwise order so the loop never crosses itself — this is what lets
// us connect "every outer dot radially" for both convex and concave regions.
function convexHull(points: Array<[number, number]>): Array<[number, number]> {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (
    o: [number, number],
    a: [number, number],
    b: [number, number],
  ) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const n = pts.length;
  if (n < 3) return pts;

  const lower: Array<[number, number]> = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Array<[number, number]> = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// Derive the enclosing loop of a newly captured region: the player's alive
// dots adjacent to the enclosed cells. Their convex hull gives the outer dots
// in radial (non-self-intersecting) order, so tracing starts at the dot nearest
// the last-placed dot.
function computeCaptureRing(
  coords: Array<[number, number]>,
  color: PlayerColor,
  aliveByColor: Map<PlayerColor, Set<string>>,
  rows: number,
  cols: number,
  lastDot: [number, number] | null,
): Array<[number, number]> | null {
  const neigh = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
  ];
  const ringKeys = new Set<string>();
  for (const [r, c] of coords) {
    for (const [dr, dc] of neigh) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const k = `${nr},${nc}`;
      if (ringKeys.has(k)) continue;
      if (aliveByColor.get(color)?.has(k)) ringKeys.add(k);
    }
  }

  const hull = convexHull([...ringKeys].map((k) => k.split(",").map(Number) as [number, number]));
  if (hull.length < 3) return null; // a ring needs at least 3 dots to enclose

  // Rotate so the loop starts at the completing (last-placed) dot.
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < hull.length; i++) {
    if (!lastDot) break;
    const dr = hull[i][0] - lastDot[0];
    const dc = hull[i][1] - lastDot[1];
    const d = dr * dr + dc * dc;
    if (d < bestD) { bestD = d; best = i; }
  }
  return hull.slice(best).concat(hull.slice(0, best));
}

export default function GameBoard() {
  const { room, me, activePlayerId, remainingMs, placeDot } = useGameStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [layout, setLayout] = useState<BoardLayout | null>(null);

  // Latest render inputs kept in a ref so the animation loop reads current
  // values without needing to be re-created on every state change.
  const latest = useRef({ room, layout, hover, me, activePlayerId, gameOver: false, remainingMs: 60_000 });
  useEffect(() => {
    latest.current = {
      room, layout, hover, me, activePlayerId,
      gameOver: !!room?.gameOver,
      remainingMs,
    };
  });

  // Animation clock + per-move bookkeeping. The clock resets only when the
  // board *content* changes (a dot placed / a capture applied), not on the
  // per-second timer ticks, so pops and fade-outs play cleanly once per move.
  const animStart = useRef(0);
  const prevSig = useRef("");
  const prevKeys = useRef(new Set<string>());
  const placed = useRef(new Set<string>());
  const died = useRef(new Set<string>());
  const territories = useRef(new Map<string, PlayerColor>());

  // Real-capture bookkeeping: cells that were territory last move (to detect
  // new captures), regions currently animating their flourish, and region
  // outlines that have finished animating and now stay on the board.
  const prevTerritoryKeys = useRef(new Set<string>());
  const animating = useRef<CapturedRegion[]>([]);
  const persisted = useRef<PersistedRegion[]>([]);

  useEffect(() => {
    if (!room) return;
    const dots = room.dots as ServerDot[];
    const lastDotKey = dots.length ? `${dots[dots.length - 1].r},${dots[dots.length - 1].c}` : "";
    const sig = dots.map((d) => `${d.r},${d.c}:${d.ownerId}:${d.isAlive}:${d.capturedBy}`).join(";") + "|" + lastDotKey;

    if (sig !== prevSig.current) {
      prevSig.current = sig;
      animStart.current = performance.now();

      const newDied = new Set<string>();
      const newPlaced = new Set<string>();
      for (const d of dots) {
        const k = `${d.r},${d.c}`;
        const wasAlive = prevKeys.current.has(k);
        if (d.isAlive && !wasAlive) newPlaced.add(k);
        else if (!d.isAlive && wasAlive) newDied.add(k);
      }
      prevKeys.current = new Set(dots.map((d) => `${d.r},${d.c}`));
      placed.current = newPlaced;
      died.current = newDied;
      territories.current = computeTerritories(dots, room.config.grid.rows, room.config.grid.cols, (id) => colorForId(room.players, id));

      // --- Detect newly captured regions and kick off their flourish ---
      // Alive dots grouped by color, so we can find each region's enclosing loop.
      const aliveByColor = new Map<PlayerColor, Set<string>>();
      for (const d of dots) {
        if (!d.isAlive) continue;
        const c = colorForId(room.players, d.ownerId);
        if (!c) continue;
        if (!aliveByColor.has(c)) aliveByColor.set(c, new Set());
        aliveByColor.get(c)!.add(`${d.r},${d.c}`);
      }

      // Cells that became territory this move (territory is created all at once
      // when a loop closes, so every cell of a fresh region is new here).
      const prev = prevTerritoryKeys.current;
      const newByKey = new Map<PlayerColor, Set<string>>();
      for (const [k, color] of territories.current) {
        if (!prev.has(k)) {
          if (!newByKey.has(color)) newByKey.set(color, new Set());
          newByKey.get(color)!.add(k);
        }
      }

      const lastDot: [number, number] | null = lastDotKey
        ? (lastDotKey.split(",").map(Number) as [number, number])
        : null;
      const regions: CapturedRegion[] = [];
      for (const [color, keys] of newByKey) {
        // Group the new cells into connected components (a single move can close
        // several separate loops, or bridge two regions into one).
        const visited = new Set<string>();
        for (const start of keys) {
          if (visited.has(start)) continue;
          const stack = [start];
          visited.add(start);
          const compKeys = new Set<string>();
          while (stack.length) {
            const cur = stack.pop()!;
            compKeys.add(cur);
            const [r, c] = cur.split(",").map(Number);
            for (const [dr, dc] of DIRS_4) {
              const nk = `${r + dr},${c + dc}`;
              if (keys.has(nk) && !visited.has(nk)) { visited.add(nk); stack.push(nk); }
            }
          }
          const verts = computeCaptureRing(
            [...compKeys].map((k) => k.split(",").map(Number) as [number, number]),
            color,
            aliveByColor,
            room.config.grid.rows,
            room.config.grid.cols,
            lastDot
          );
          if (verts) {
            regions.push({
              color,
              cells: [...compKeys].map((k) => k.split(",").map(Number) as [number, number]),
              verts,
              t0: performance.now(),
              traceMs: 520,
              fadeMs: 260,
            });
          }
        }
      }
      if (regions.length) animating.current = [...animating.current, ...regions];

      prevTerritoryKeys.current = new Set(territories.current.keys());
    }
  }, [room]);

  // Keep the canvas sized to fit the viewport, recomputed on resize.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onResize = () => {
      const availW = window.innerWidth;
      const availH = window.innerHeight - 40; // leave room for the HUD
      const next = computeBoardLayout(room?.config.grid.rows ?? 20, room?.config.grid.cols ?? 20, availW, availH);
      el.style.width = next.width + "px";
      el.style.height = next.height + "px";
      el.width = Math.round(next.width * next.dpr);
      el.height = Math.round(next.height * next.dpr);
      setLayout(next);
    };
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [room]);

  // Continuous render loop: draws every frame using the latest state and the
  // elapsed time since the last board change for in-progress animations.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const loop = () => {
      const s = latest.current;
      // Promote finished capture animations into permanent outlines.
      const stillAnimating: CapturedRegion[] = [];
      for (const region of animating.current) {
        if (performance.now() - region.t0 > region.traceMs + region.fadeMs) {
          persisted.current.push({ color: region.color, verts: region.verts });
        } else {
          stillAnimating.push(region);
        }
      }
      animating.current = stillAnimating;
      if (s.room && s.layout && s.me && !s.gameOver) {
        const elapsed = performance.now() - animStart.current;
        const lastDotKey = s.room.dots.length ? `${s.room.dots[s.room.dots.length - 1].r},${s.room.dots[s.room.dots.length - 1].c}` : "";
        draw(ctx, s.room, s.layout, s.hover, elapsed, lastDotKey, placed.current, died.current, animating.current, persisted.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!room || !me) return null;

  const occupied = new Set((room.dots as ServerDot[]).map((d) => `${d.r},${d.c}`));
  const isMyTurn = activePlayerId === me.id;
  const gameOver = room.gameOver;

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!layout || !room) return;
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pt = pixelToPoint(layout, room.config.grid.rows, room.config.grid.cols, e.clientX - rect.left, e.clientY - rect.top);
    const free = pt && !occupied.has(`${pt.r},${pt.c}`) && isMyTurn && !gameOver;
    setHover(free ? pt : null);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!layout || !room) return;
    if (!isMyTurn || gameOver) return;
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pt = pixelToPoint(layout, room.config.grid.rows, room.config.grid.cols, e.clientX - rect.left, e.clientY - rect.top);
    if (pt && !occupied.has(`${pt.r},${pt.c}`)) {
      placeDot(pt.r, pt.c);
      setHover(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <Hud
        room={room}
        me={me}
        activePlayerId={activePlayerId}
        remainingMs={remainingMs}
      />
      <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
        <div className="w-fit rounded-2xl bg-slate-800/40 border border-slate-700/60 shadow-2xl shadow-black/30 p-3">
          <canvas
            ref={canvasRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="select-none touch-none"
            style={{ touchAction: "none" }}
          />
        </div>
      </div>
      <GameOverModal />
    </div>
  );
}

// --- Drawing ---------------------------------------------------------------

function draw(
  ctx: CanvasRenderingContext2D,
  room: SerializedRoom,
  layout: BoardLayout,
  hover: { r: number; c: number } | null,
  elapsed: number,
  lastDotKey: string,
  placed: Set<string>,
  died: Set<string>,
  animating: CapturedRegion[],
  persisted: PersistedRegion[],
) {
  ctx.clearRect(0, 0, layout.width, layout.height);

  const rows = room.config.grid.rows;
  const cols = room.config.grid.cols;

  // 1. Resting territory fill (25%), drawn first so grid lines and dots read on
  //    top. Each captured region is filled as a solid polygon (from its hull
  //    outline) so the region stays continuously shaded — and stays filled —
  //    once its flourish finishes, rather than dropping to disconnected dots.
  if (persisted.length) {
    for (const poly of persisted) {
      if (poly.verts.length < 3) continue;
      ctx.fillStyle = rgba(COLOR_HEX[poly.color], 0.25);
      ctx.beginPath();
      for (let i = 0; i < poly.verts.length; i++) {
        const p = pointToPixel(layout, poly.verts[i][0], poly.verts[i][1]);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  // 1b. Fill-in for captures mid-animation (drawn behind grid/dots so it fades
  //     in cleanly over the resting territory level).
  if (animating.length) {
    for (const region of animating) {
      const elapsed = performance.now() - region.t0;
      if (elapsed > region.traceMs * 0.85) {
        const ft = Math.min(1, (elapsed - region.traceMs * 0.85) / region.fadeMs);
        ctx.fillStyle = rgba(COLOR_HEX[region.color], 0.25 * ft);
        ctx.beginPath();
        for (let i = 0; i < region.verts.length; i++) {
          const p = pointToPixel(layout, region.verts[i][0], region.verts[i][1]);
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // 2. Grid lines.
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#334155";
  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    const a = pointToPixel(layout, r, 0);
    const b = pointToPixel(layout, r, cols - 1);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  for (let c = 0; c < cols; c++) {
    const a = pointToPixel(layout, 0, c);
    const b = pointToPixel(layout, rows - 1, c);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();

  // 3. Empty grid points (faint, slightly smaller).
  const occupied = new Set((room.dots as ServerDot[]).map((d) => `${d.r},${d.c}`));
  ctx.fillStyle = "#1e293b";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!occupied.has(`${r},${c}`)) {
        const p = pointToPixel(layout, r, c);
        ctx.beginPath();
        ctx.arc(p.x, p.y, layout.cellSize * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 4. Hover preview.
  if (hover) {
    const p = pointToPixel(layout, hover.r, hover.c);
    ctx.beginPath();
    ctx.arc(p.x, p.y, layout.cellSize * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 5. Dots.
  for (const d of room.dots) {
    const p = pointToPixel(layout, d.r, d.c);
    const color = colorForId(room.players, d.ownerId);
    if (!color) continue;
    const hex = COLOR_HEX[color];

    if (d.isAlive) {
      const placedThisMove = placed.has(`${d.r},${d.c}`);
      const t = Math.min(1, elapsed / POP_MS);
      const scale = placedThisMove ? 1 - Math.pow(1 - t, 3) * 0.6 : 1;
      const alpha = placedThisMove ? t : 1;
      drawBead(ctx, p.x, p.y, layout.cellSize * 0.32 * scale, hex, alpha);
    } else {
      // Captured (dead) dot: keep its original owner's colour. A red dot that
      // blue captures stays red — it does not turn the capturer's colour.
      const diedThisMove = died.has(`${d.r},${d.c}`);
      if (diedThisMove && elapsed < CAPTURE_MS) {
        const t = elapsed / CAPTURE_MS;
        const rr = layout.cellSize * (0.3 + t * 0.5);
        ctx.strokeStyle = rgba(color, 1 - t);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      drawExtinguished(ctx, p.x, p.y, layout.cellSize, color);
    }
  }

  // 6. Most-recent dot: fading double-ring highlight.
  if (lastDotKey) {
    const d = room.dots.find((d) => `${d.r},${d.c}` === lastDotKey);
    if (d) {
      const p = pointToPixel(layout, d.r, d.c);
      const t = Math.min(1, elapsed / LAST_MOVE_MS);
      ctx.strokeStyle = rgba("#f8fafc", 1 - t);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, layout.cellSize * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rgba("#f8fafc", (1 - t) * 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, layout.cellSize * 0.34, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 7. Capture flourish: trace the enclosing loop radially from the completing
  //    dot (drawn on top so the loop reads as walls between beads).
  if (animating.length) {
    for (const region of animating) {
      const elapsed = performance.now() - region.t0;
      const n = region.verts.length;
      const prog = Math.min(1, elapsed / region.traceMs);
      const full = Math.floor(prog * n);
      const frac = prog * n - full;
      ctx.lineWidth = Math.max(2, layout.cellSize * 0.09);
      ctx.strokeStyle = rgba(COLOR_HEX[region.color], 1);
      ctx.beginPath();
      for (let i = 0; i < full; i++) {
        const a = pointToPixel(layout, region.verts[i][0], region.verts[i][1]);
        const b = pointToPixel(layout, region.verts[(i + 1) % n][0], region.verts[(i + 1) % n][1]);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      if (full < n) {
        // Grow the current segment toward the next vertex.
        const a = pointToPixel(layout, region.verts[full][0], region.verts[full][1]);
        const b = pointToPixel(layout, region.verts[(full + 1) % n][0], region.verts[(full + 1) % n][1]);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + (b.x - a.x) * frac, a.y + (b.y - a.y) * frac);
      } else {
        // Close the loop: last vertex back to the first.
        const a = pointToPixel(layout, region.verts[n - 1][0], region.verts[n - 1][1]);
        const b = pointToPixel(layout, region.verts[0][0], region.verts[0][1]);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
  }

  // 8. Persistent region outlines — the "walls" stay drawn after captures.
  if (persisted.length) {
    for (const poly of persisted) {
      const n = poly.verts.length;
      ctx.lineWidth = Math.max(2, layout.cellSize * 0.07);
      ctx.strokeStyle = rgba(COLOR_HEX[poly.color], 0.6);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = pointToPixel(layout, poly.verts[i][0], poly.verts[i][1]);
        const b = pointToPixel(layout, poly.verts[(i + 1) % n][0], poly.verts[(i + 1) % n][1]);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
  }
}

// A rounded "bead" with a radial highlight so alive dots read as small gems.
function drawBead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  hex: string,
  alpha = 1,
) {
  if (r <= 0) return;
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  grad.addColorStop(0, shade(hex, 0.5));
  grad.addColorStop(0.45, hex);
  grad.addColorStop(1, shade(hex, -0.3));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// A captured dot: dimmed, outlined in its new owner's colour, crossed out.
function drawExtinguished(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  ownerColor: string,
) {
  const r = cellSize * 0.27;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = ownerColor;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 4);
  ctx.lineTo(x + 4, y + 4);
  ctx.moveTo(x + 4, y - 4);
  ctx.lineTo(x - 4, y + 4);
  ctx.stroke();
}

// --- HUD -------------------------------------------------------------------

function Hud({
  room,
  me,
  activePlayerId,
  remainingMs,
}: {
  room: SerializedRoom;
  me: SerializedRoom["players"][number];
  activePlayerId: string | null;
  remainingMs: number;
}) {
  const { leaveRoom } = useGameStore();
  const active = room.players.find((p) => p.id === activePlayerId);
  const activeColor = active ? colorForId(room.players, active.id) : undefined;
  const pct = Math.max(0, Math.min(100, (remainingMs / 60_000) * 100));
  const is20Mode = room.config.mode === "20";

  return (
    <div className="bg-slate-900/80 border-b border-slate-700 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tight">
            <span className="text-red-400">D</span>
            <span className="text-blue-400">o</span>
            <span className="text-green-400">t</span>
            <span className="text-yellow-400">s</span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span className="hidden sm:inline">
            {active ? (
              <>
                <span
                  className="inline-block w-3 h-3 rounded-full mr-1"
                  style={{ background: activeColor ? COLOR_HEX[activeColor] : "#64748b" }}
                />
                {active.name}'s turn
              </>
            ) : (
              "Waiting…"
            )}
          </span>
          <span className="sm:hidden">
            {active ? playerColorHex(active.color) : ""} {active?.name ?? "Waiting"}
          </span>
          <LeaveButton onClick={() => leaveRoom()} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-sky-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-mono text-slate-300 whitespace-nowrap">
          {TIME_FORMAT_MS(remainingMs)}
        </span>
        {is20Mode && (
          <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
            you {me.score}/20
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {room.players.map((p) => {
          const isActive = p.id === activePlayerId;
          const glow = isActive && activeColor ? `0 0 0 2px ${COLOR_HEX[activeColor]}` : undefined;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive ? "bg-slate-700" : "bg-slate-800/50"
              } ${p.disconnected || p.connected === false ? "opacity-60" : ""}`}
              style={glow ? { boxShadow: glow } : undefined}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: playerColorHex(p.color) }}
              />
              <span className="font-medium text-white max-w-[8rem] truncate">
                {p.name}
                {p.id === me.id ? " (you)" : ""}
                {p.disconnected ? " · disconnected" : ""}
              </span>
              <span className="font-bold text-slate-200">{p.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeaveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
    >
      Leave
    </button>
  );
}

// --- Game over -------------------------------------------------------------

function GameOverModal() {
  const { gameOver, room, navigate } = useGameStore();
  if (!gameOver || !room) return null;

  const ranked = [...gameOver.players].sort((a, b) => b.score - a.score);
  const winner = gameOver.winner;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-2xl">
        <div className="text-center space-y-1">
          {winner ? (
            <>
              <p className="text-sm text-slate-400">Winner</p>
              <div className="flex items-center justify-center gap-2 text-3xl font-black">
                <span
                  className="inline-block w-5 h-5 rounded-full"
                  style={{ background: COLOR_HEX[winner.color] }}
                />
                <span className="text-white">{winner.name}</span>
              </div>
            </>
          ) : (
            <h2 className="text-2xl font-bold text-white">Game Over</h2>
          )}
        </div>

        <ol className="space-y-2">
          {ranked.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/60"
            >
              <span className="text-sm text-slate-500 w-6 text-center">
                {i === 0 && winner ? "👑" : `#${i + 1}`}
              </span>
              <span
                className="w-4 h-4 rounded-full"
                style={{ background: COLOR_HEX[p.color] }}
              />
              <span className="font-medium text-white flex-1">
                {p.name}
                {p.disconnected ? " (disconnected)" : ""}
              </span>
              <span className="font-bold text-slate-200">{p.score}</span>
            </li>
          ))}
        </ol>

        <button
          onClick={() => navigate("menu")}
          className="w-full px-6 py-3 rounded-xl font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}

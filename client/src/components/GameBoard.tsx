import { useGameStore } from "../socketContext";
import { COLOR_HEX, TIME_FORMAT_MS } from "../lib/format";
import {
  BoardLayout,
  computeBoardLayout,
  pointToPixel,
  pixelToPoint,
} from "../lib/geometry";
import { colorForId, playerColorHex, type SerializedRoom, type ServerDot } from "../types";
import { useEffect, useRef, useState } from "react";

export default function GameBoard() {
  const { room, me, activePlayerId, remainingMs, placeDot } = useGameStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [layout, setLayout] = useState<BoardLayout | null>(null);

  // Keep a canvas sized to fit the viewport, recomputed on resize.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onResize = () => {
      const availW = window.innerWidth;
      const availH = window.innerHeight - 40; // leave room for the HUD
      const next = computeBoardLayout(room?.grid.rows ?? 20, room?.grid.cols ?? 20, availW, availH);
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

  // Draw whenever the relevant inputs change.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !layout || !room || !me) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    draw(ctx, room, me.id, layout, hover);
  }, [room, layout, hover, me]);

  if (!room || !me) return null;

  const occupied = new Set((room.dots as ServerDot[]).map((d) => `${d.r},${d.c}`));
  const isMyTurn = activePlayerId === me.id;
  const gameOver = room.gameOver;
  const lastDot = room.dots[room.dots.length - 1] ?? null;
  const lastDotKey = lastDot ? `${lastDot.r},${lastDot.c}` : "";

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!layout || !room) return;
    const rect = el.getBoundingClientRect();
    const pt = pixelToPoint(layout, room.grid.rows, room.grid.cols, e.clientX - rect.left, e.clientY - rect.top);
    const free = pt && !occupied.has(`${pt.r},${pt.c}`) && isMyTurn && !gameOver;
    setHover(free ? pt : null);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!layout || !room) return;
    if (!isMyTurn || gameOver) return;
    const rect = el.getBoundingClientRect();
    const pt = pixelToPoint(layout, room.grid.rows, room.grid.cols, e.clientX - rect.left, e.clientY - rect.top);
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
      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="select-none touch-none"
          style={{ touchAction: "none" }}
        />
      </div>
      <GameOverModal />
    </div>
  );
}

// --- Drawing ---------------------------------------------------------------

function draw(ctx: CanvasRenderingContext2D, room: SerializedRoom, myId: string, layout: BoardLayout, hover: { r: number; c: number } | null) {
  ctx.clearRect(0, 0, layout.width, layout.height);

  const dots = room.dots;
  const occupied = new Set(dots.map((d) => `${d.r},${d.c}`));

  // Grid lines.
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#334155";
  ctx.beginPath();
  for (let r = 0; r < room.grid.rows; r++) {
    const a = pointToPixel(layout, r, 0);
    const b = pointToPixel(layout, r, room.grid.cols - 1);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  for (let c = 0; c < room.grid.cols; c++) {
    const a = pointToPixel(layout, 0, c);
    const b = pointToPixel(layout, room.grid.rows - 1, c);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();

  // Empty grid points (faint).
  ctx.fillStyle = "#1e293b";
  for (let r = 0; r < room.grid.rows; r++) {
    for (let c = 0; c < room.grid.cols; c++) {
      if (!occupied.has(`${r},${c}`)) {
        const p = pointToPixel(layout, r, c);
        ctx.beginPath();
        ctx.arc(p.x, p.y, layout.cellSize * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Hover preview.
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

  // Dots.
  for (const d of dots) {
    const p = pointToPixel(layout, d.r, d.c);
    const color = colorForId(room.players, d.ownerId);
    if (color) {
      const hex = COLOR_HEX[color];
      if (d.isAlive) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, layout.cellSize * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = hex;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.stroke();
      } else {
        // Captured dot: faded, outlined, crossed out.
        ctx.beginPath();
        ctx.arc(p.x, p.y, layout.cellSize * 0.26, 0, Math.PI * 2);
        ctx.fillStyle = "#0f172a";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = hex;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(p.x - 4, p.y - 4);
        ctx.lineTo(p.x + 4, p.y + 4);
        ctx.moveTo(p.x + 4, p.y - 4);
        ctx.lineTo(p.x - 4, p.y + 4);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#94a3b8";
        ctx.stroke();
      }
    }
  }

  // Most-recent dot: double ring highlight.
  if (lastDot && `${lastDot.r},${lastDot.c}` === lastDotKey) {
    const p = pointToPixel(layout, lastDot.r, lastDot.c);
    ctx.beginPath();
    ctx.arc(p.x, p.y, layout.cellSize * 0.4, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#f8fafc";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, layout.cellSize * 0.34, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(248,250,252,0.7)";
    ctx.stroke();
  }
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

  return (
    <div className="bg-slate-900/80 border-b border-slate-700 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tight">
            <span className="text-red-400">Т</span>
            <span className="text-blue-400">о</span>
            <span className="text-green-400">ч</span>
            <span className="text-yellow-400">к</span>
            <span className="text-red-400">и</span>
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
                {active.name}’s turn
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
      </div>

      <div className="flex flex-wrap gap-2">
        {room.players.map((p) => {
          const isActive = p.id === activePlayerId;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive ? "bg-slate-700" : "bg-slate-800/50"
              } ${p.disconnected || p.connected === false ? "opacity-60" : ""}`}
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

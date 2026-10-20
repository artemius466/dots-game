import { useGameStore } from "../socketContext";
import { useState } from "react";
import { PLAYER_COLORS } from "../constants";
import { COLOR_HEX } from "../lib/format";

const BTN =
  "relative overflow-hidden px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";

export default function MainMenu() {
  const { nickname, setNickname, navigate, flashToast } = useGameStore();
  const [view, setView] = useState<"main" | "mp">("main");

  return (
    <div className="relative w-full max-w-xl mx-auto space-y-8 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 px-6 py-7 shadow-2xl shadow-slate-950/50">
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-black tracking-tight select-none">
          {"Dots".split("").map((ch, i) => (
            <span
              key={i}
              className="inline-block animate-[pop_0.6s_cubic-bezier(0.16,1,0.3,1)_forwards]"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <span className="text-red-400">{ch}</span>
            </span>
          ))}
        </h1>
        <p className="text-slate-400">Dots — free-for-all capture game</p>
      </div>

      <HowToPlayTeaser />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300" htmlFor="nick">
          Nickname
        </label>
        <input
          id="nick"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Enter a nickname"
          maxLength={18}
          className="w-full px-4 py-3 rounded-xl bg-slate-800/70 border border-slate-600 text-white
                     placeholder-slate-500 focus:outline-none focus-visible:ring-2
                     focus-visible:ring-sky-400"
        />
      </div>

      {view === "main" && (
        <div className="space-y-3">
          <button
            onClick={() => flashToast("Bots aren't ready yet — coming soon!")}
            className={`w-full ${BTN} bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white btn-shimmer`}
          >
            Play with Bot
          </button>
          <button
            onClick={() => setView("mp")}
            className={`w-full ${BTN} bg-slate-700 hover:bg-slate-600 text-white`}
          >
            Multiplayer
          </button>
        </div>
      )}

      {view === "mp" && (
        <div className="space-y-3">
          <button
            onClick={() => navigate("host")}
            className={`w-full ${BTN} bg-sky-600 hover:bg-sky-500 text-white btn-shimmer`}
          >
            Create Room
          </button>
          <button
            onClick={() => navigate("join")}
            className={`w-full ${BTN} bg-slate-700 hover:bg-slate-600 text-white`}
          >
            Join Room
          </button>
          <button
            onClick={() => setView("main")}
            className="w-full px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors hover:-translate-y-0.5"
          >
            ← Back
          </button>
        </div>
      )}

      <PlayerLegend />

      <footer className="text-center text-xs text-slate-600">
        First to 20 dots, or whoever controls the most space when the grid is full.
      </footer>
    </div>
  );
}

// A tiny looping diagram: three colored dots, lines connecting them in sequence,
// then the enclosed region fills — a self-explanating "how it works".
function HowToPlayTeaser() {
  const pts: Array<{ p: [number, number]; c: string }> = [
    { p: [30, 66], c: COLOR_HEX["Red"] },
    { p: [96, 66], c: COLOR_HEX["Blue"] },
    { p: [60, 22], c: COLOR_HEX["Green"] },
  ];
  const edges: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 0],
  ];

  return (
    <div className="flex flex-col items-center gap-2.5">
      <svg width="150" height="100" viewBox="0 0 120 90" aria-hidden="true">
        <polygon
          points={pts.map((d) => d.p.join(",")).join(" ")}
          className="teaser-fill"
        />
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={pts[a].p[0]}
            y1={pts[a].p[1]}
            x2={pts[b].p[0]}
            y2={pts[b].p[1]}
            className="teaser-line"
            style={{ animationDelay: `${i * 0.3}s` }}
          />
        ))}
        {pts.map((d, i) => (
          <circle
            key={i}
            cx={d.p[0]}
            cy={d.p[1]}
            r={5.5}
            fill={d.c}
            className="teaser-dot"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </svg>
      <p className="text-xs text-center text-slate-500 max-w-[260px]">
        Connect two of your dots to claim the space between them.
      </p>
    </div>
  );
}

// Player-color legend rendered as pulsing colored beads instead of plain text.
function PlayerLegend() {
  return (
    <footer className="flex flex-col items-center gap-2">
      <p className="text-xs font-medium text-slate-500">Players</p>
      <div className="flex items-center gap-5">
        {PLAYER_COLORS.map((name, i) => (
          <div key={name} className="flex flex-col items-center gap-1">
            <span
              className="inline-block w-4 h-4 rounded-full pulse-dot shadow-sm"
              style={{
                background: COLOR_HEX[name],
                animationDelay: `${i * 0.35}s`,
              }}
            />
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: COLOR_HEX[name] }}
            >
              {name}
            </span>
          </div>
        ))}
      </div>
    </footer>
  );
}

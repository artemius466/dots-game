import { useGameStore } from "../socketContext";
import { GRID_OPTIONS, MAX_PLAYERS } from "../constants";
import { MODE_OPTIONS } from "../constants";
import type { RoomConfig } from "../types";
import { useState } from "react";

interface Draft {
  maxPlayers: number;
  grid: { rows: number; cols: number };
  mode: "20" | "all";
  modeLabel: "20 dots" | "All grid";
}

export default function HostRoomConfig() {
  const { navigate, createRoom } = useGameStore();
  const [draft, setDraft] = useState<Draft>({
    maxPlayers: 2,
    grid: { rows: GRID_OPTIONS[0].rows, cols: GRID_OPTIONS[0].cols },
    mode: "20",
    modeLabel: "20 dots",
  });

  const setPlayers = (maxPlayers: number) => setDraft((d) => ({ ...d, maxPlayers }));
  const setGrid = (g: { rows: number; cols: number }) => setDraft((d) => ({ ...d, grid: g }));
  const setMode = (mode: "20" | "all", modeLabel: "20 dots" | "All grid") =>
    setDraft((d) => ({ ...d, mode, modeLabel }));

  const submit = () => {
    const config: RoomConfig = { ...draft };
    createRoom(config);
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("menu")}
          className="px-3 py-1 text-sm text-slate-400 hover:text-white"
        >
          ← Back
        </button>
        <h2 className="text-2xl font-bold">Set up your room</h2>
      </div>

      <div className="space-y-4 bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-300 px-1">Max Players</legend>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => i + 2).map((n) => (
              <button
                key={n}
                onClick={() => setPlayers(n)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  draft.maxPlayers === n
                    ? "bg-sky-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-300 px-1">Board</legend>
          <div className="flex flex-wrap gap-2">
            {GRID_OPTIONS.map((g) => (
              <button
                key={g.label}
                onClick={() => setGrid({ rows: g.rows, cols: g.cols })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  draft.grid.rows === g.rows && draft.grid.cols === g.cols
                    ? "bg-sky-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-300 px-1">Game Mode</legend>
          <div className="flex flex-wrap gap-2">
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.modeLabel}
                onClick={() => setMode(m.mode, m.modeLabel)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  draft.mode === m.mode
                    ? "bg-sky-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {m.modeLabel}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {draft.mode === "20"
              ? "First to 20 dots wins."
              : "Dominate the whole board; most dots at the end wins."}
          </p>
        </fieldset>
      </div>

      <button
        onClick={submit}
        className="w-full px-6 py-3 rounded-xl font-bold bg-sky-600 hover:bg-sky-500 text-white
                   transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        Create Room
      </button>
    </div>
  );
}

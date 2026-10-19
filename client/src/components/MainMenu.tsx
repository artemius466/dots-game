import { useGameStore } from "../socketContext";
import { useState } from "react";
import { colorNames } from "../types";

const BTN =
  "px-6 py-3 rounded-xl font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";

export default function MainMenu() {
  const { nickname, setNickname, navigate, flashToast } = useGameStore();
  const [view, setView] = useState<"main" | "mp">("main");

  return (
    <div className="w-full max-w-md mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-black tracking-tight">
          <span className="text-red-400">D</span>
          <span className="text-blue-400">o</span>
          <span className="text-green-400">t</span>
          <span className="text-yellow-400">s</span>
        </h1>
        <p className="text-slate-400">Dots — free-for-all capture game</p>
      </div>

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
            className={`w-full ${BTN} bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white`}
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
            className={`w-full ${BTN} bg-sky-600 hover:bg-sky-500 text-white`}
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
            className="w-full px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
        </div>
      )}

      <footer className="text-center text-xs text-slate-600">
        Players marked by color: {colorNames.join(", ")}
      </footer>
    </div>
  );
}

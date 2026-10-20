import { useState } from "react";
import { useGameStore } from "./socketContext";
import MainMenu from "./components/MainMenu";
import HostRoomConfig from "./components/HostRoomConfig";
import JoinMenu from "./components/JoinMenu";
import WaitingLobby from "./components/WaitingLobby";
import GameBoard from "./components/GameBoard";

import DotsBackdrop from "./components/DotsBackdrop";

const SoundOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

const SoundOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    <path d="M22 9 15 16" />
    <path d="M15 9l7 7" />
  </svg>
);

export default function App() {
  const { screen, connecting, toast, error } = useGameStore();

  // Sound/effects toggle (UI only — audio isn't wired up yet). Persists preference.
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem("dots.sound") !== "off";
    } catch {
      return true;
    }
  });
  const toggleSound = () =>
    setSoundOn((s) => {
      try {
        localStorage.setItem("dots.sound", s ? "off" : "on");
      } catch {}
      return !s;
    });

  return (
    <div className="min-h-screen flex flex-col relative">
      {screen === "menu" && (
        <>
          <DotsBackdrop />
          <div
            aria-hidden
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, transparent 45%, rgba(3,7,18,0.6) 100%)",
            }}
          />
        </>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw]
                     px-5 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white
                     shadow-xl text-sm font-medium animate-[fadein_0.15s_ease-out]"
        >
          {toast}
        </div>
      )}

      <header className="px-5 py-3 flex items-center justify-between border-b border-slate-800 relative z-10">
        <span className="text-lg font-black tracking-tight text-white">
          <span className="text-red-400">D</span>
          <span className="text-blue-400">o</span>
          <span className="text-green-400">t</span>
          <span className="text-yellow-400">s</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            aria-label={soundOn ? "Mute sound effects" : "Enable sound effects"}
            title={soundOn ? "Sound on" : "Sound off"}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
          </button>
          {connecting && (
            <span className="text-xs text-amber-300 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
              Connecting…
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 overflow-auto relative z-10">
        {screen === "menu" && <MainMenu />}
        {screen === "host" && <HostRoomConfig />}
        {screen === "join" && <JoinMenu />}
        {screen === "lobby" && <WaitingLobby />}
        {(screen === "playing" || screen === "gameover") && <GameBoard />}
      </main>
    </div>
  );
}

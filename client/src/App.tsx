import { useGameStore } from "./socketContext";
import MainMenu from "./components/MainMenu";
import HostRoomConfig from "./components/HostRoomConfig";
import JoinMenu from "./components/JoinMenu";
import WaitingLobby from "./components/WaitingLobby";
import GameBoard from "./components/GameBoard";

export default function App() {
  const { screen, connecting, toast, error } = useGameStore();

  return (
    <div className="min-h-screen flex flex-col">
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

      <header className="px-5 py-3 flex items-center justify-between border-b border-slate-800">
        <span className="text-lg font-black tracking-tight text-white">
          <span className="text-red-400">Т</span>
          <span className="text-blue-400">о</span>
          <span className="text-green-400">ч</span>
          <span className="text-yellow-400">к</span>
          <span className="text-red-400">и</span>
        </span>
        {connecting && (
          <span className="text-xs text-amber-300 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
            Connecting…
          </span>
        )}
      </header>

      <main className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {screen === "menu" && <MainMenu />}
        {screen === "host" && <HostRoomConfig />}
        {screen === "join" && <JoinMenu />}
        {screen === "lobby" && <WaitingLobby />}
        {(screen === "playing" || screen === "gameover") && <GameBoard />}
      </main>
    </div>
  );
}

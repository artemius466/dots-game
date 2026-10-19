import { useGameStore } from "../socketContext";
import { playerColorHex } from "../types";
import { useState } from "react";

export default function WaitingLobby() {
  const { room, me, startGame, navigate, leaveRoom } = useGameStore();
  const [copied, setCopied] = useState(false);

  if (!room || !me) return null;

  const players = room.players;
  const isHost = players[0]?.id === me.id;
  const canStart = players.length >= 2 && isHost;

  const copy = async () => {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold">Waiting for players…</h2>
        <p className="text-slate-400">Share this room code:</p>
        <div className="flex items-center justify-center gap-3">
          <div className="px-6 py-3 text-3xl font-black tracking-[0.3em] bg-slate-800/70 border border-slate-600 rounded-xl text-sky-300">
            {room.code}
          </div>
          <button
            onClick={copy}
            className="px-3 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-300">
          <span>Players: {players.length} / {room.config.maxPlayers}</span>
          <span>Board: {room.config.grid.rows} × {room.config.grid.cols}</span>
          <span>Mode: {room.config.modeLabel}</span>
        </div>

        <ul className="space-y-2">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/50"
            >
              <span
                className="w-4 h-4 rounded-full"
                style={{ background: playerColorHex(p.color) }}
              />
              <span className="font-medium text-white">{p.name}</span>
              <span className="text-xs text-slate-500">
                {p.id === me.id ? "(you)" : ""}
                {p.id === players[0]?.id ? " · host" : ""}
              </span>
              <span className="ml-auto">
                {p.connected ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">
                    connected
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                    connected…
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        {canStart ? (
          <button
            onClick={startGame}
            className="w-full px-6 py-3 rounded-xl font-bold bg-green-600 hover:bg-green-500 text-white transition-colors"
          >
            Start Game
          </button>
        ) : (
          <p className="text-center text-sm text-slate-500">
            {isHost ? "Waiting for at least one more player to start…" : "You are a guest. The host will start the game."}
          </p>
        )}
        <button
          onClick={() => {
            leaveRoom();
            navigate("menu");
          }}
          className="w-full px-6 py-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}

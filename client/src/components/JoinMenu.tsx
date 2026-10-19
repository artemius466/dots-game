import { useGameStore } from "../socketContext";
import { ROOM_CODE_LENGTH } from "../constants";
import { useState, useEffect, useRef } from "react";

export default function JoinMenu() {
  const { navigate, joinRoom } = useGameStore();
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [copiedRoom, setCopiedRoom] = useState("");

  // Keep the input uppercase & alphanumeric only.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const change = (raw: string) => {
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length <= ROOM_CODE_LENGTH) setCode(cleaned);
  };

  const submit = () => joinRoom(code);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopiedRoom(code);
    setTimeout(() => setCopiedRoom(""), 1500);
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("menu")} className="px-3 py-1 text-sm text-slate-400 hover:text-white">
          ← Back
        </button>
        <h2 className="text-2xl font-bold">Join a room</h2>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-300" htmlFor="code">
          Room code
        </label>
        <input
          ref={inputRef}
          id="code"
          value={code}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={"A".repeat(ROOM_CODE_LENGTH)}
          maxLength={ROOM_CODE_LENGTH}
          spellCheck={false}
          autoComplete="off"
          className="w-full px-4 py-4 text-center text-3xl font-bold tracking-[0.4em] rounded-xl
                     bg-slate-800/70 border border-slate-600 text-white placeholder-slate-600
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        />
        <p className="text-xs text-slate-500">
          {ROOM_CODE_LENGTH} characters, letters and numbers only.
        </p>
      </div>

      <button
        onClick={submit}
        disabled={code.length !== ROOM_CODE_LENGTH}
        className="w-full px-6 py-3 rounded-xl font-bold bg-sky-600 hover:bg-sky-500 disabled:opacity-40
                   disabled:cursor-not-allowed text-white transition-colors"
      >
        Join
      </button>
    </div>
  );
}

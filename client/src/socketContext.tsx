import { io, Socket } from "socket.io-client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ROOM_CODE_LENGTH } from "./constants";
import type {
  GameOverInfo,
  MyPlayer,
  RoomConfig,
  SerializedRoom,
} from "./types";

const WS_BASE =
  import.meta.env.VITE_WS_URL || (import.meta.env.DEV ? "http://localhost:4000" : "");

type Screen = "menu" | "host" | "join" | "lobby" | "playing" | "gameover";

interface GameStore {
  screen: Screen;
  me: MyPlayer | null;
  code: string | null;
  config: RoomConfig | null;
  room: SerializedRoom | null;
  gameOver: GameOverInfo | null;
  activePlayerId: string | null;
  remainingMs: number;
  nickname: string;
  connecting: boolean;
  toast: string | null;
  error: string | null;

  setNickname: (name: string) => void;
  navigate: (screen: Screen) => void;
  createRoom: (config: RoomConfig) => void;
  joinRoom: (code: string) => void;
  startGame: () => void;
  placeDot: (r: number, c: number) => void;
  restartGame: () => void;
  leaveRoom: () => void;
  handleServerError: (msg: string) => void;
  flashToast: (msg: string) => void;
}

const NickKey = "dots-game-nickname";

const loadNickname = (): string => {
  try {
    const v = localStorage.getItem(NickKey);
    if (v && v.trim()) return v.trim();
  } catch {
    /* ignore */
  }
  return "";
};

class Store implements GameStore {
  screen: Screen = "menu";
  me: MyPlayer | null = null;
  code: string | null = null;
  config: RoomConfig | null = null;
  room: SerializedRoom | null = null;
  gameOver: GameOverInfo | null = null;
  activePlayerId: string | null = null;
  remainingMs: number = 60_000;
  nickname: string = loadNickname();
  connecting = false;
  toast: string | null = null;
  error: string | null = null;

  private socket: Socket | null = null;
  private listeners = new Set<() => void>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  private connect() {
    if (this.socket || WS_BASE === "") return;
    this.connecting = true;
    this.emit();
    const socket = io(WS_BASE, {
      transports: ["websocket", "polling"],
      reconnection: true,
      forceNew: true,
    });
    this.socket = socket;

    socket.on("connect", () => {
      this.connecting = false;
      this.error = null;
      this.emit();
    });
    socket.on("disconnect", (reason) => {
      this.connecting = false;
      this.flashToast(`Disconnected from server (${reason})`);
      this.emit();
    });

    socket.on("roomJoined", (res: { code: string; me: string; player: MyPlayer }) => {
      this.me = res.player;
      this.code = res.code;
      this.screen = "lobby";
      this.error = null;
      this.emit();
    });

    socket.on("error", (msg: string) => {
      this.handleServerError(msg);
    });

    socket.on("state", (room: SerializedRoom) => {
      this.room = room;
      this.activePlayerId = room.activePlayerId;
      this.config = room.config;
      if (room.gameOver) {
        this.screen = "gameover";
      } else {
        this.screen = "playing";
      }
      this.emit();
    });

    socket.on("timer", (t: { remaining: number; activePlayerId: string | null }) => {
      this.remainingMs = t.remaining;
      this.activePlayerId = t.activePlayerId;
      this.emit();
    });

    socket.on("captures", () => {
      this.flashToast("Region captured! 🎉");
    });

    socket.on("gameOver", (info: GameOverInfo) => {
      this.gameOver = info;
      this.screen = "gameover";
      this.emit();
    });

    this.emit();
  }

  setNickname(name: string) {
    const trimmed = name.trim();
    this.nickname = trimmed;
    try {
      localStorage.setItem(NickKey, trimmed);
    } catch {
      /* ignore */
    }
    this.emit();
  }

  navigate(screen: Screen) {
    this.screen = screen;
    this.error = null;
    this.emit();
  }

  createRoom(config: RoomConfig) {
    this.connect();
    const nick = this.nickname || "Player";
    this.socket?.emit("createRoom", { nickname: nick, config });
  }

  joinRoom(rawCode: string) {
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== ROOM_CODE_LENGTH) {
      this.handleServerError(`Room code must be ${ROOM_CODE_LENGTH} characters`);
      return;
    }
    this.connect();
    const nick = this.nickname || "Player";
    this.socket?.emit("joinRoom", { nickname: nick, code });
  }

  startGame() {
    this.socket?.emit("startGame", this.code ?? "");
  }

  placeDot(r: number, c: number) {
    if (!this.code) return;
    this.socket?.emit("placeDot", { r, c });
  }

  restartGame() {
    this.socket?.emit("restartGame", this.code ?? "");
  }

  leaveRoom() {
    this.socket?.emit("leaveRoom", this.code ?? "");
    this.reset();
  }

  reset() {
    this.me = null;
    this.code = null;
    this.config = null;
    this.room = null;
    this.gameOver = null;
    this.activePlayerId = null;
    this.remainingMs = 60_000;
    this.screen = "menu";
  }

  handleServerError(msg: string) {
    this.error = msg;
    this.flashToast(msg);
  }

  flashToast(msg: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = msg;
    this.emit();
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.emit();
    }, 2200);
  }
}

const store = new Store();
store.connect();

const GameContext = createContext<GameStore>(store);

export function useGameStore(): GameStore {
  return useContext(GameContext);
}

// Subscribes a component to store changes.
export function useStore(selector: (s: GameStore) => unknown): GameStore {
  const s = useGameStore();
  const [, force] = useState(0);
  useEffect(() => {
    const unsub = store.subscribe(() => force((n) => n + 1));
    return unsub;
  }, []);
  return s;
}

function SocketProvider({ children }: { children: React.ReactNode }) {
  const store = useGameStore();
  return (
    <GameContext.Provider value={store}>
      {children}
    </GameContext.Provider>
  );
}

export { SocketProvider };

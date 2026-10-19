# Точки — Dots (Multiplayer)

A real-time multiplayer implementation of the classic **"Dots"** (Russian: *Точки*) paper game.

Two players draw connected lines between dots on a grid, trying to enclose their opponent's dots inside their own closed loops. Whoever encloses the most dots wins.

- **Authoritative server** (Node/TypeScript, Socket.IO) — the single source of truth for game state, turn order, captures, and win conditions.
- **Realtime client** (React + Vite + Tailwind + HTML5 `<canvas>`) — renders the board and syncs every move over WebSockets.

Built to run locally, but the client connects to the server over HTTP(S), so it's ready to deploy on any static-hosting platform.

---

## Contents
- [Game Rules](#game-rules)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [How to Play](#how-to-play)
- [Socket API Reference](#socket-api-reference)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Build & Deploy](#build--deploy)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Game Rules

Players take turns. On your turn you draw a single line segment between two **adjacent** grid intersections (including diagonals) that aren't already connected.

- **Close a loop** → the lines form a closed shape. Any intersection **strictly inside** the shape becomes *locked* (nobody can draw through it again).
- **Capture** → every dot **strictly inside** your closed loop that belongs to your *alive* chain is scored for you.
  - If you enclose an **opponent's** live dot, you also "steal" those points (their score for that dot is voided and reassigned to you).
  - **Nested loops** are handled: if you enclose a *larger* region that contains another player's already-captured dots, your outer loop reclaims those points.
- **Dead ends**: if you draw into a region owned by an opponent, that placement is itself captured (the "delayed"/suicidal move).

The turn automatically passes to the next player after each move. If a player is offline or exceeds the turn timer (60 s), their turn is skipped.

### Win Conditions

There are two game modes, selectable when you create a room:

| Mode         | Config value | How the game ends                                              |
|--------------|--------------|---------------------------------------------------------------|
| **20 dots**  | `"20"`       | First player to reach **20 captured dots** wins.              |
| **All grid** | `"all"`      | When no intersection can ever be used again (all dots/locked cells), the player with the most points wins. Ties are broken by color assignment. |

### Board Sizes

Three grid sizes are available (must match on the server and client — the client enforces this):

| Label        | Rows × Cols |
|--------------|-------------|
| `20 × 20`    | 20 × 20     |
| `30 × 30`    | 30 × 30     |
| `39 × 32`    | 39 × 32     |

Up to **4 players** per room (Red, Blue, Green, Yellow), cyclic turn order.

---

## Features

- ✅ Realtime multiplayer over WebSockets (authoritative server).
- ✅ Host/join rooms with a human-readable **6-letter code**.
- ✅ Configurable game mode + grid size before play.
- ✅ Live scoreboard and per-player colors.
- ✅ HTML5 `<canvas>` board with:
  - animated line drawing,
  - hover preview of valid moves,
  - owner-color rendering of lines,
  - captured (dead) dot highlighting,
  - "most recent line" emphasis for turn awareness.
- ✅ Turn timer with a per-second countdown and auto-skip on timeout.
- ✅ Capture notifications and nested-loop (score-stealing) logic.
- ✅ Disconnection handling — disconnected players are marked and their turns skipped.
- ✅ Game-over screen with winner and final scores; restart supported.
- ✅ Fully type-checked (TypeScript) on both ends.
- ✅ Responsive layout (board scales to viewport; HUD pinned to the top).

---

## Tech Stack

**Server** — `server/`
| Concern       | Library            |
|---------------|--------------------|
| Runtime       | Node.js (via `tsx`) |
| HTTP          | Express            |
| WebSockets    | Socket.IO          |
| CORS          | `cors`             |
| Language      | TypeScript         |

**Client** — `client/`
| Concern        | Library / Tool      |
|---------------|---------------------|
| Build         | Vite                |
| UI            | React 18            |
| Styling       | Tailwind CSS        |
| Rendering     | HTML5 `<canvas>`    |
| Networking    | `socket.io-client`  |
| Language      | TypeScript          |

---

## Architecture

```
┌──────────────┐   Socket.IO (WebSocket)   ┌──────────────┐
│  Client      │ ───────────────────────▶  │  Server      │
│  React +     │ ◀───────────────────────  │  Express +   │
│  <canvas>     │    state / timer /        │  Socket.IO   │
│  Vite        │    events                 │  (authoritative)│
└──────────────┘                           └──────────────┘
```

The **client is a dumb renderer**: it never decides who wins or whether a move is valid. It sends intent (`placeDot`) and subscribes to `state` events. The server owns all game logic (see `server/src/engine.ts`) and broadcasts a serialized room snapshot on every change.

---

## Prerequisites

- **Node.js 18+** (developed and tested on Node v26). Both the server and client are run through `tsx` (server) and Vite (client), which handle TypeScript natively — no separate compile step required.
- No account keys or database needed. Everything runs in-memory.

---

## Quick Start

Open **two terminals** in the project root (`~/dots-game`).

### 1. Start the server

```bash
cd server
npm install
npm run dev
```

The server logs `Dots server listening on http://localhost:4000`.

### 2. Start the client

```bash
cd client
npm install
npm run dev
```

Vite prints a URL (default `http://localhost:5173`). Open it in your browser.

### 3. Play

Because a single browser can't host two simultaneous clients, play tests with **two windows/tabs**:
1. Tab A → **Play with Bot** *(coming soon)* or create a room → share the code.
2. Tab B → join with the room code.
3. Host clicks **Start Game**.

For a quick local smoke test against the API, see [Testing](#testing).

---

## Configuration

### Server (`server/src/types.ts`)

| Setting        | Default    | Note                                        |
|----------------|------------|---------------------------------------------|
| `PORT`         | `4000`     | Overridable via `process.env.PORT`.         |
| `TURN_TIME_MS` | `60_000`   | Per-turn timer; expiry skips the player.    |
| `ALLOWED_GRIDS`| 20×20, 30×30, 39×32 | Must match the client's `GRID_OPTIONS`. |
| `MAX_PLAYERS`  | `4`        | Max players per room.                       |
| `WINNING_SCORE_20` | `20`   | Win threshold for the "20 dots" mode.       |
| CORS           | `origin: "*"` | Open for dev; restrict in production.     |

### Client (`client/vite.config.ts` & `src/constants.ts`)

| Setting        | Default    | Note                                        |
|----------------|------------|---------------------------------------------|
| `server.port`  | `5173`     | Vite dev server port.                       |
| `@` alias      | → `./src`  | Absolute import alias.                      |
| `CODE_ALPHABET`| `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` | Room-code alphabet (matches server). |

> ⚠️ **Keep the constants in sync.** `client/src/constants.ts` and `server/src/types.ts` must agree on grids, players, colors, and turn time, or clients will send configs the server rejects.

### CORS in production

The server uses `cors()` with `origin: "*"`. When deploying the client to a different origin, either keep `*` or set the specific allowed origins for security.

---

## How to Play

1. **MainMenu** → choose to host a room (set mode + grid + player count) or join an existing one.
2. **WaitingLobby** → the host waits until the minimum number of players have joined. Everyone sees the live scoreboard.
3. **Start Game** → host starts; the canvas board appears.
4. **Take your turn** → hover a dot to preview the move, then click to draw the line.
5. **Win** → reach 20 captured dots (mode *20*), or have the most points when the grid is exhausted (mode *all*).

---

## Socket API Reference

All events are Socket.IO named events. The server is authoritative.

### Client → Server (requests)

| Event        | Payload                                   | Description                                   |
|--------------|-------------------------------------------|-----------------------------------------------|
| `createRoom` | `{ nickname, config }`                    | Create a room; returns a room code. Host = first player. |
| `joinRoom`   | `{ nickname, code }`                      | Join an existing room by code.               |
| `startGame`  | `code: string`                            | Start the game (host only; needs ≥2 players).|
| `placeDot`   | `{ r, c }`                                | Draw a line segment between two intersections.|
| `restartGame`| `code: string`                            | Rematch (host only).                          |
| `leaveRoom`  | `code: string`                            | Leave a room.                                 |

### Server → Client (events)

| Event        | Payload                                                                 | Description                                   |
|--------------|-------------------------------------------------------------------------|-----------------------------------------------|
| `connect`    | —                                                                       | Socket connected (client side).               |
| `roomJoined` | `{ code, me, player }`                                                  | Confirms you're in the room; `me` is your socket id. |
| `error`      | `string`                                                                | Rejection reason (e.g. `Room not found`).     |
| `state`      | `SerializedRoom`                                                        | Authoritative room snapshot; emitted on every change. |
| `timer`      | `{ remaining: number, activePlayerId }`                                 | Per-second countdown (seconds left).          |
| `captures`   | capture details                                                         | A capture just happened.                      |
| `gameOver`   | `{ winner, players, mode }`                                             | Game finished; `winner` may be null for a tie. |
| `disconnect` | —                                                                       | Socket disconnected (client side).            |

### `SerializedRoom` shape

```ts
interface SerializedRoom {
  code: string;
  config: { maxPlayers: number; grid: { rows: number; cols: number }; mode: "20" | "all" };
  players: { id: string; name: string; color: string; connected: boolean; score: number }[];
  dots: { r: number; c: number; ownerId: string; isAlive: boolean; capturedBy: string | null }[];
  intersections: { r: number; c: number; locked: boolean }[];
  activePlayerId: string | null;
  winnerId: string | null;
  gameOver: boolean;
}
```

---

## Project Structure

```
dots-game/
├── server/                     # Authoritative backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── test.ts                 # Game-rule unit tests (10 cases)
│   └── src/
│       ├── index.ts            # Express + Socket.IO entrypoint
│       ├── socketService.ts    # Socket event handlers + serialization
│       ├── rooms.ts            # Room manager + room-code generator
│       ├── engine.ts           # Core game logic (movement, capture, win)
│       └── types.ts            # Shared types + constants
└── client/                     # Frontend
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig*.json
    ├── src/
    │   ├── App.tsx             # Root + screen routing + toast overlay
    │   ├── main.tsx            # React entry
    │   ├── index.css           # Tailwind + base styles
    │   ├── constants.ts        # Board/mode/color constants (mirrors server)
    │   ├── types.ts            # Client types (mirrors server SerializedRoom)
    │   ├── socketContext.tsx   # Socket store + game state
    │   ├── components/
    │   │   ├── MainMenu.tsx
    │   │   ├── HostRoomConfig.tsx
    │   │   ├── JoinMenu.tsx
    │   │   ├── WaitingLobby.tsx
    │   │   └── GameBoard.tsx   # Canvas renderer (lines, dots, hover)
    │   └── lib/
    │       ├── geometry.ts     # Responsive board layout math
    │       └── format.ts       # Color hex + time formatters
    └── public/
        └── dot.svg             # Favicon
```

---

## Testing

The server ships a hand-rolled test suite (`server/test.ts`) covering the trickiest game logic — basic captures, free-region non-captures, delayed/suicidal captures, nested-loop score stealing, and the 20-dot win condition.

```bash
cd server
npm run test
```

Expected output:

```
Test 1: basic square capture
  ✓ Red captured the 1 interior blue dot
...
Test 5: 20-dots win
  ✓ Red wins at 20

10 passed, 0 failed
```

---

## Build & Deploy

### Build the client (production bundle)

```bash
cd client
npm run build   # typecheck + Vite production build → dist/
```

Output: `client/dist/index.html`, `client/dist/assets/`, and `client/dist/dot.svg`.

### Preview the production bundle (locally)

```bash
cd client
npm run preview
```

### Deploy

1. **Server:** run `npm start` (or `npm run build && node dist/index.js`) behind any Node-capable host (Heroku, Railway, Render, a PM2 process, etc.). Set `PORT` to the port your provider expects, and configure CORS for your frontend origin.
2. **Client:** deploy `client/dist/` to any static host (Vercel, Netlify, GitHub Pages, S3). Point the client's Socket.IO connection at your deployed server's URL.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Client can't connect to server | Confirm the server is running and CORS allows the client origin (`localhost:5173` by default). |
| "Room not found" on join | Room codes are 6 letters; re-copy from the lobby. Rooms are in-memory only. |
| Build fails with `invalid JS syntax` | A stale `src/*.js` from an earlier `tsc -b` run can shadow `.tsx` files during Vite's extension resolution — delete `src/**/*.js` and rebuild. |
| `placeDot` does nothing | It's your opponent's turn, the cell is occupied/locked, or the game is over. Check the `timer`/`state` events. |
| Turn never advances | The active player disconnected; the turn is skipped on the server. |

---

## License

MIT. Feel free to reuse the engine logic and architecture for your own projects.

# AGENTS.md

Dots (Точки) — a real-time multiplayer paper game. **Authoritative server** owns all game logic; the **client is a dumb renderer** that sends move intent and subscribes to authoritative state.

## Layout

- `server/` — Node + Express + Socket.IO. `src/engine.ts` is the source of truth (movement, capture, win). `src/socketService.ts` (event handlers + serialization), `src/rooms.ts` (room manager), `src/index.ts` (entry, `:4000`, health at `/api/health`), `src/types.ts` (shared constants).
- `client/` — React + Vite + Tailwind + `<canvas>`. `src/socketContext.tsx` is the game store; `src/components/` is the screen flow (`MainMenu` → `WaitingLobby` → `GameBoard`). `src/constants.ts` mirrors the server.
- The two ends share config by duplication (see below) — there is no shared package.

## Commands (verified against package.json)

- Dev server: `cd server && npm run dev` (tsx watch) → listens on `:4000`.
- Client dev: `cd client && npm run dev` → `:5173`.
- **Run tests: `cd server && npx tsx test.ts`** — the suite (`server/test.ts`) self-invokes and calls `process.exit()`. There is **no `npm run test` script** (the README lists one that doesn't exist).
- Build client: `npm run build` = `tsc --noEmit && vite build`. ⚠️ `tsc --noEmit` **currently errors** on pre-existing issues (unused locals in `App.tsx`/`JoinMenu.tsx`/`socketContext.tsx`, untyped Vite `import.meta.env`, private `Store` access) — so `npm run build` / `npm run typecheck` fail today. For a working bundle, run `npx vite build` directly (esbuild is lenient), or fix the type errors first.

## Invariants you must respect

- **Authoritative server.** Never move game logic (validity, captures, scoring, win conditions) into the client. Change it in `server/src/engine.ts`. The client only renders `state` snapshots and sends intent (`placeDot`, `startGame`, …).
- **Constants are duplicated, not shared.** `client/src/constants.ts` and `server/src/types.ts` must agree on grids, player colors, modes, turn time, and room-code alphabet (`CODE_ALPHABET` in `server/src/rooms.ts`). Mismatched values → server rejects the client's config.
- Client ↔ server uses Socket.IO **named events** (see the README "Socket API Reference"). The board grid size must match between client `GRID_OPTIONS` and server `ALLOWED_GRIDS`.

## Ops gotchas

- Docker: `docker compose up --build` (server `:4000`, client on `:5173` via nginx `:80`). To point the client at a different server, set `VITE_WS_URL` in `.env` and **restart the container — no rebuild** needed; `client/entrypoint.sh` writes the address into `/env.json` on start.
- Room codes are 6 characters; **rooms are in-memory only** — restarting the server drops all rooms.
- To test two players in one machine, open two browser windows/tabs (a single browser can't host two clients at once).
- Node 18+; everything runs in-memory — no DB or API keys required.

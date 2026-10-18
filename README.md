# Ludo Connect

A production-minded, real-time multiplayer Ludo web app built as a single
Next.js codebase: local players sharing one device, remote players joining
over the internet via a link, all playing the same authoritative match.

## Tech stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling/UI:** Tailwind CSS, shadcn/ui, lucide-react
- **Real-time:** Socket.IO, attached to a custom Node HTTP server alongside Next
- **Database:** MongoDB Atlas via Mongoose (optional but recommended — see below)
- **Validation:** Zod
- **Forms:** React Hook Form
- **Tests:** Vitest (game engine unit tests)

## Architecture

This is **one repository, one process**. `server/index.ts` is the actual
entry point: it boots Next.js programmatically, creates a plain Node
`http.Server`, hands HTTP requests to Next's request handler, and attaches a
Socket.IO server to the *same* `http.Server`. There is no separate backend
service and no serverless function hosting Socket.IO — this is deliberate,
because a persistent WebSocket server cannot live in a stateless serverless
function.

- **Route Handlers** (`src/app/api/rooms/**`) handle one-shot HTTP
  operations: creating a room, fetching room info, joining a seat.
- **Socket.IO** (`server/socket/index.ts`) handles everything about an
  active match: presence, dice rolls, token moves, turn order, and
  broadcasting the authoritative game state to everyone in the room.
- **Game engine** (`src/lib/game/*`) is pure TypeScript with zero React or
  network dependencies — it's exhaustively unit tested (`npm test`) and is
  the single source of truth for Ludo rules. The board UI reads its layout
  from `src/lib/ui/boardLayout.ts`, which is generated from one quarter of
  the board rotated 90° three times, so the four colors are geometrically
  guaranteed to be consistent.
- **Room/seat model** (`src/lib/rooms/*`) is the glue: an in-memory
  `Map<roomId, RoomRecord>` (`src/lib/rooms/store.ts`) is the actual source
  of truth while the server is running (both the REST routes and the
  Socket.IO handlers run in the same process, so they share this one Map).
  MongoDB, if configured, is a persistence **mirror** of that in-memory
  state, written on every meaningful change and used to rehydrate a room
  after a server restart.

### Seats, not accounts

There's no login. A "seat" (0-3, one per color) is claimed one of three ways:

- at **room creation**, when the host picks how many local players (1-4)
  share their device — those seats get a shared `deviceGroupId` and one
  secret seat token each,
- as a **computer-controlled seat**, filled automatically when the host
  picks "Vs computer" or "Quick test" — see below, or
- via the **invite link**, where a remote joiner claims exactly one open
  seat.

### Room size and seat layout

A room has 2, 3, or 4 seats (`roomSize`, chosen at creation). The 4 colors
are fixed to physical seat slots 0-3 (red/green/yellow/blue), but which
*slots* are in play depends on room size — see `SEAT_LAYOUTS` in
`src/lib/rooms/roomService.ts`:

- **2 seats** → slots `[0, 2]` (red, yellow) — diagonally opposite corners
  of the board, matching how a real 1v1 Ludo match is played.
- **3 seats** → slots `[0, 1, 2]`.
- **4 seats** → all slots.

### Computer-controlled seats

Picking "Vs computer" (or the one-click "Quick test vs computer" on the
home page) fills the remaining seats with `kind: "bot"`. Bots have no
credential and are always reported as connected. The server drives every
consecutive bot turn itself (`driveBotTurns` in `server/socket/index.ts`):
it calls the same `rollForSeat`/`moveForSeat` functions a human action
would, broadcasts the same events, and only stops when a human seat is
next or the match ends. The bot's move choice (`src/lib/game/bot.ts`) is a
simple heuristic — finish a token, then capture an opponent, then release
from the yard, then advance the furthest-along token — picked only from
the engine's own legal-move list, so it can never produce an illegal move.

### Quick mode

Checking "Quick match" at room creation (or using "Quick test vs
computer") sets `quickMode: true` on the room, which gives each player 2
tokens instead of 4 (`QUICK_TOKENS_PER_PLAYER` in `src/lib/game/config.ts`)
and speeds up the bots' own turn pacing. Every rule — dice rolls, capture,
exact-roll-to-finish, win detection — is unchanged; only the token count
and bot delay are scaled down, so a full match finishes in roughly a
minute instead of being a 20+ minute game.

The raw seat token is returned to the client exactly once and stored in that
browser's `localStorage`; the server only ever stores its SHA-256 hash. A
device proves it controls a seat by presenting that seat's token when it
opens a Socket.IO connection (`room:join` with `seatTokens: string[]`) — this
is how one phone can legitimately act for 2-3 local seats while nobody else
can move those seats' tokens.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in MONGODB_URI if you have one
npm run dev
```

Open http://localhost:3000. The dev server is the real custom server (with
Socket.IO attached), not plain `next dev` — see `package.json` scripts.

### Environment variables

See `.env.example` for the full list with descriptions. The short version:

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | No (recommended) | Without it, rooms/games live only in memory and are lost on restart. |
| `APP_ORIGIN` | Yes in production | Comma-separated list of allowed origins (CORS). |
| `PORT` | No | Defaults to 3000. |
| `NEXT_PUBLIC_APP_URL` | Yes in production | Used to build shareable invite links. |

### Scripts

- `npm run dev` — custom server + Socket.IO, with `tsx watch` for reload
- `npm run build` — `next build`
- `npm run start` — runs the custom server in production mode
- `npm test` — Vitest unit tests for the game engine
- `npm run lint` — ESLint

## Testing

`npm test` runs the game-engine unit tests (release-on-six, legal-move
computation, exact-roll-to-finish, captures, safe squares, win detection,
turn order/auto-skip). These are pure-function tests with no network or DB
involved.

The realtime (Socket.IO) and REST layers were exercised manually end-to-end
during development (room creation, joining, starting, rolling, moving,
capturing, unauthorized-action rejection, full-room/invalid-room/
already-started error paths, and reconnect-with-stored-credential). There
is no automated integration-test suite for the socket layer yet — if you add
one, `socket.io-client` is already a dependency you can reuse for it.

## Known limitations (documented by design)

- **Single server instance.** The in-memory room store
  (`src/lib/rooms/store.ts`) is a plain `Map` in one Node process. Running
  multiple instances behind a load balancer would require a shared store
  (e.g. Redis) and the [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/)
  — out of scope for this MVP.
- **MongoDB is optional.** If `MONGODB_URI` is unset, the app still works,
  but a server restart loses every active room and game. Set it for real
  deployments.
- **Minimal move history.** `GameHistory.moveLog` stores the events from the
  winning move only, not a full replay log — extending it is straightforward
  (append every move's events as they happen) but wasn't needed for the MVP.
- **Rule choices**, documented in `src/lib/game/config.ts`:
  - Three consecutive sixes do **not** cancel a turn (common house rule,
    intentionally left out).
  - Only rolling a six grants an extra roll — captures and reaching home do
    not.
  - No "blocking": tokens (own or opponents') can share a cell; only an
    opponent's token on a non-safe shared cell gets captured.
  - The match ends the moment one player finishes all 4 tokens (no 2nd/3rd
    place tracking).
  - Room creation only asks the host for *one* display name (per the spec).
    Extra local seats are auto-labeled "Name (P2)", "Name (P3)" rather than
    prompting for each — there's no in-lobby rename for the MVP.
  - The dice visually floats to the current player's board corner
    (`yardCenterPercent` in `src/lib/ui/boardLayout.ts`) rather than
    staying fixed — this is the "current turn" indicator together with the
    pulsing turn banner and player-panel highlight in `GameScreen.tsx`.
  - "Vs computer" mode is always 1 human + bots filling the rest of the
    chosen room size — there's no UI for mixing multiple humans with bots
    in the same room (you can still do that indirectly: create a normal
    "with others" room, since bots are only offered in the dedicated mode).

## Deployment

**Do not deploy this to a plain serverless/edge platform** (e.g. Vercel's
default serverless functions) — Socket.IO needs one long-lived process with
a real, persistent HTTP server, which serverless functions are not. Deploy
it anywhere that runs a persistent Node process: Render, Railway, Fly.io,
a plain VPS, or a Docker host.

General steps (Render is a good free-tier-friendly default):

1. Push this repo to GitHub.
2. Create a MongoDB Atlas cluster, get its connection string.
3. Create a new "Web Service" from the repo on your host of choice:
   - Build command: `npm install && npm run build`
   - Start command: `npm run start`
4. Set environment variables: `MONGODB_URI`, `APP_ORIGIN` (your production
   URL), `NEXT_PUBLIC_APP_URL` (same URL), `NODE_ENV=production`.
5. Make sure the platform proxies WebSocket upgrade requests (Render,
   Railway and Fly all do this by default for a web service listening on
   `$PORT`).

### Free-tier caveats

Most free tiers spin your service down after a period of inactivity and
spin it back up on the next request. For this app that means:

- The in-memory room store is wiped on every cold start — a long-idle room
  will be gone unless `MONGODB_URI` is set (and even then, the room has to
  be re-loaded from Mongo on the next request that touches it, which this
  app does automatically).
- A player reconnecting during the cold-start window will see a brief
  "reconnecting" state while the instance spins back up.

## Project structure

```
server/                Custom Node server entry + Socket.IO wiring (not bundled by Next)
src/app/                Next.js App Router pages and API route handlers
src/components/         UI components (home, lobby, board, room)
src/hooks/              Client hooks (useRoomSocket)
src/lib/game/           Pure game engine + board configuration (unit tested)
src/lib/rooms/          Room/seat business logic, in-memory store, Mongo mirror
src/lib/db/             Mongoose connection + models
src/lib/socket/         Shared Socket.IO event names/payload types
src/lib/validation/     Zod schemas
src/lib/ui/             Presentation-only helpers (board geometry, color theme)
```

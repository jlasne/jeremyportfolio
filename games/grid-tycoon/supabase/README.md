# Grid Tycoon multiplayer backend

Supabase Postgres + Realtime, with every write and every round resolution in one edge function,
`grid-tycoon`, that runs the same engine as the browser. Rules: SPEC.md "Multiplayer", DESIGN.md
section 8. Multiplayer is **offline** until the steps below are done: the app checks
`isOnline()` (src/net), which is false while no URL / key is configured.

```
supabase/
  migrations/0001_grid_tycoon.sql     tables, RLS, grants, updated_at triggers, Realtime publication
  functions/grid-tycoon/
    index.ts                          Deno.serve: CORS, JSON, Postgres storage (supabase-js, service role)
    rooms.ts                          pure room logic (create/join/start/lock/tick/state/ping), engine injected
    engine.js                         GENERATED: src/engine bundled with balance.json (npm run build:edge)
  tsconfig.check.json, deno-shim.d.ts typecheck of the function without Deno (build-edge --check)
```

## Deploy (Supabase MCP tools)

1. **Project.** Use an existing project or `create_project`. Note its id.
2. **Schema.** `apply_migration` with `name: "grid_tycoon"` and `query:` the full contents of
   `supabase/migrations/0001_grid_tycoon.sql`. It is idempotent (safe to re-run). It also adds
   `gt_rooms` and `gt_players` to the `supabase_realtime` publication, so there is nothing to toggle
   in the dashboard.
3. **Engine bundle.** In `games/grid-tycoon/app`: `npm run build:edge` (or `node scripts/build-edge.mjs --check`
   to also typecheck the function). This rewrites `functions/grid-tycoon/engine.js`; rebuild it
   whenever `src/engine` or `config/balance.json` changes, or the server and the browser disagree on the rules.
4. **Function.** `deploy_edge_function` with
   - `name: "grid-tycoon"`
   - `entrypoint_path: "index.ts"`
   - `verify_jwt: false` (seats are authorized by their own tokens; the gateway must let the
     anon/publishable key through)
   - `files`: exactly these three, `name` as written, `content` = the file's text:
     `index.ts`, `rooms.ts`, `engine.js` (all from `supabase/functions/grid-tycoon/`).

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase into every function; no
   secret has to be created. If a project ever lacks `SUPABASE_SERVICE_ROLE_KEY`, the function fails
   every call with `server_error` and logs why: set it (a secret / service-role key) with
   `create_edge_function_secret`.
5. **Client config.** `get_project_url` and `get_publishable_keys` (the anon / publishable key, never
   the service role). Put them in `app/src/net/config.ts` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), or in
   `app/.env.local` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` for local dev. The key is public
   by design: RLS lets it read rooms and players and nothing else.
6. **Ship.** `npm run build` (publishes to `/games`). The title screen now offers Host / Join.
7. **Check.**
   - `get_advisors` (security): review anything about the `gt_*` tables. They are built to pass the
     usual checks (RLS on everywhere, no write policies, trigger function with a fixed `search_path`);
     "RLS enabled, no policy" notices on `gt_secrets` / `gt_decisions` are intended.
   - Smoke test:
     ```sh
     curl -s -X POST "$URL/functions/v1/grid-tycoon" -H "apikey: $ANON" -H 'content-type: application/json' \
       -d '{"action":"create","name":"Test","seats":2,"fillBots":true}'
     ```
     returns `{"ok":true,"code":"ABCDEF","seat":0,"token":"...","room":{...},"players":[...],"now":...}`.
   - `query_logs` (service `edge-function`) if anything returns `server_error`.

CLI alternative, if the Supabase CLI is around: `supabase db push` then
`supabase functions deploy grid-tycoon --no-verify-jwt` from `games/grid-tycoon`.

CORS allows `https://www.jeremylasne.com`, `https://jeremylasne.com` and `http://localhost:*` /
`http://127.0.0.1:*`. Add origins (a Vercel preview, for example) in `ALLOWED_ORIGINS` in `index.ts`.

## Data model

| Table | Holds | Clients |
| --- | --- | --- |
| `gt_rooms` | code (PK, 6 letters, no I/O), seed, status lobby/playing/finished, host_seat, round (0 in lobby, then 1..40, 41 finished), deadline, seats 2-6, fill_bots, state (full engine GameState, jsonb), created_at, updated_at | read (PostgREST + Realtime) |
| `gt_players` | (room_code, seat) PK, company_id (`p0`..`p5`), name (1-20), is_bot, locked_round, last_seen | read (PostgREST + Realtime) |
| `gt_secrets` | (room_code, seat) PK, token_hash (SHA-256 hex of the seat token) | none |
| `gt_decisions` | (room_code, round, seat) PK, decision jsonb | none |

Everything cascades from `gt_rooms`. Only the function writes (service role). A room untouched for 2
days is deleted the next time anyone creates a room (no cron).

## API

`POST /functions/v1/grid-tycoon` with a JSON body `{ "action": ..., ... }`. Every answer is
`{ ok: true, ..., now }` or `{ ok: false, error, message, issues?, round?, now }`; `now` is the
server's clock in epoch ms (the client derives its countdown offset from it). Times are epoch ms.

| Action | Input | Output |
| --- | --- | --- |
| `create` | `name`, `seats` (2-6, default 4), `fillBots` (default true) | `code, seat: 0, token, room, players` |
| `join` | `code` and either `token` (rejoin that seat) or `name` (new seat in the lobby; after start, claims a human seat away > 60 s) | `code, seat, token, rejoined, claimed, room, players` |
| `start` | `code, token` (host only) | `room, players` |
| `lock` | `code, token, round, decision` | `round, resolved, room, players` |
| `tick` | `code` (`token` optional, refreshes last_seen) | `resolved, room, players` |
| `state` | `code` (`token` optional) | `seat, room, players` |
| `ping` | `code, token` | `seat` |

`lock` and `tick` include `room.state` only when that call resolved the round (late in a game the
state is a few hundred KB; Realtime and `state` deliver it anyway).

Error codes: `bad_request`, `unknown_action`, `invalid_code`, `invalid_name`, `invalid_seats`,
`invalid_token`, `invalid_decision` (422 with the engine's `issues`, or 400 when malformed),
`room_not_found`, `room_full`, `room_started`, `room_finished`, `no_free_seat`, `not_host`,
`not_in_lobby`, `not_playing`, `not_enough_players`, `wrong_round` (with the room's `round`),
`bankrupt`, `server_error`.

Round rules: a round resolves when every non-bankrupt human seat has locked, or on the first `tick`
after `deadline` (balance.json `multiplayer.roundTimer`, 180 s). Missing humans get the engine's
`defaultDecision` (last round's allocations, no builds or finance); bots get `botDecision`. The write
is `update gt_rooms ... where code = $1 and round = $expected and status = 'playing'`, so concurrent
locks and ticks resolve a round exactly once. If no human is left in the race (all bankrupt), the
remaining rounds are played out at once. Re-locking before resolution replaces the decision.

## Tests and local checks

There is no Supabase project or Deno in the dev container, so:

- `npm test` runs `src/net/rooms.test.ts` (room rules on the real engine with in-memory storage) and
  `src/net/client.test.ts` (the client against the in-memory server, with fake timers for the
  deadline tick and the heartbeat).
- `node scripts/build-edge.mjs --check` bundles the engine and typechecks `index.ts` + `rooms.ts`.
- The migration was applied twice to a scratch Postgres 16 with `anon` / `authenticated` /
  `service_role` roles: anon can select rooms and players, cannot write, and gets permission denied
  on secrets and decisions; cascades and the round compare-and-set behave.

## For the UI (src/net)

```ts
import { isOnline, OFFLINE_MESSAGE, createRoom, joinRoom, startGame, subscribeRoom, netBridge,
  companyIdForSeat, msLeft, isLocked, isAway, inviteUrl, roomCodeFromUrl, lastSeat, forgetSeat } from '../net'
```

- `isOnline()` false → show `OFFLINE_MESSAGE`, disable Host / Join.
- Host: `createRoom({ name, seats, fillBots })`; join: `joinRoom({ code, name })` (rejoins
  automatically when this browser holds a token for the room; a stale token is dropped and the join
  retried as a new player). Invite link: `inviteUrl(code)`; on load `roomCodeFromUrl()` gives the code.
  Results are `{ ok: true, ... } | { ok: false, error, message, issues? }`, never thrown.
- Then `subscribeRoom(code, onRoom, onPlayers, { onPresence, onStatus, onSeatLost, onError })`
  (keep the handle, call `close()` when leaving). It refetches on (re)connect, tab focus and network
  return, polls while Realtime is down, pings every 20 s, and ticks the server once the deadline
  passes, so a round never hangs.
- In `onRoom`: when `room.status !== 'lobby'` and `room.state`, call
  `useGame.getState().setRemote(room.state, companyIdForSeat(mySeat))` (mySeat from the join/create
  result or `savedSeat(code)`). setRemote already detects a new round and plays the results.
- Register `setNetBridge(netBridge(code, { onLeave: () => sub.close() }))` so the store's `lockIn`
  submits; `submit` rejects on failure, which reopens the decision phase.
- Top bar countdown: `msLeft(room)`; who has locked: `isLocked(player, room)`; presence from
  `onPresence` (`[{ seat, name }]`), and `isAway(player)` for seats the server has not heard from.
- Host-only Start button: `room.hostSeat === mySeat`, `startGame(code)`; `not_enough_players` when
  alone without bots.
- Offline development without Supabase:
  `const { createMemoryBackend } = await import('./net/memory'); useBackend(createMemoryBackend().backend)`
  runs the real room logic in the page (a single browser; use `server.service.join(...)` to add
  fake players). Keep it a dynamic import so it never ships in the solo bundle.

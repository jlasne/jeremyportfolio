# Grid Tycoon multiplayer server (Convex)

The live server for rooms at `https://www.jeremylasne.com/games/ABCDEF`. Convex project
`grid-tycoon` (team jeremy-lasne): production `fabulous-rooster-542`, dev `quaint-walrus-741`.
It is a separate project from the wellness backend (`wellness-api/`), so a deploy here never touches it.

- `convex/http.ts`: `POST https://fabulous-rooster-542.eu-west-1.convex.site/grid-tycoon` with
  `{ action, ... }`. Same contract as the Supabase function (`../supabase/README.md`, "API").
- `convex/game.ts`: `handle` runs one action in one mutation (a serializable transaction, so a round
  resolves exactly once). `watch` is the reactive query browsers subscribe to (room head + players,
  no state). `scheduledTick` resolves a round at its deadline even with every browser closed.
- The room rules and the engine are shared, not copied: `../supabase/functions/grid-tycoon/rooms.ts`
  and `engine.js` (built from `app/src/engine` by `app/scripts/build-edge.mjs`).
- Tokens: 32 random bytes from the HTTP action, only their SHA-256 is stored.
- Clients can only call these functions; tables are never exposed.

Deploy after any engine or balance change, or the server and the browser disagree on the rules:

```bash
cd games/grid-tycoon/convex-server && npm install && npm run deploy
```

`npm run deploy` rebuilds `engine.js`, then runs `convex deploy -y`. It needs `npx convex login` once
on the machine, or `CONVEX_DEPLOY_KEY` set. The browser reads the URL from `app/src/net/config.ts`
(`CONVEX_URL`), or `VITE_CONVEX_URL` in `app/.env.local`.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The game is served from jeremylasne.com/games/grid-tycoon/ by the site's
// static Vercel project, which has no build step. `npm run build` writes the
// bundle to dist/ and scripts/publish.mjs copies it up one folder, where it is
// committed. Everything is relative to the base, so the folder can move.
export default defineConfig({
  base: '/games/grid-tycoon/',
  plugins: [react()],
  server: { port: 5174, open: false },
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
})

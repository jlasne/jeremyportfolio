import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The game is served from jeremylasne.com/games/ by the site's static Vercel
// project, which has no build step. `npm run build` writes the bundle to dist/
// and scripts/publish.mjs copies it to /games, where it is committed. The
// source stays in /games/grid-tycoon. Load runtime files through
// import.meta.env.BASE_URL so the base can move.
export default defineConfig({
  base: '/games/',
  plugins: [react()],
  server: { port: 5174, open: false },
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
})

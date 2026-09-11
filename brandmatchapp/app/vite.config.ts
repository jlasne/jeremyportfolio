import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app is served from the root of its own domain, brandmatch.app, by a
// Vercel project whose root directory is /brandmatchapp. Assets sit next to
// the index, so the base is the root. Routes are hashes, so the host needs no
// rewrite rule to answer a deep link.
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: { port: 5173, open: false },
})

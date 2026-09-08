import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built folder works from any path or host.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, open: false },
})

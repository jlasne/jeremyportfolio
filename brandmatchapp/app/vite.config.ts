import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Absolute base. The host serves /brandmatchapp without adding a trailing
// slash, so relative asset paths would resolve one level too high and 404.
export default defineConfig({
  base: '/brandmatchapp/',
  plugins: [react()],
  server: { port: 5173, open: false },
})

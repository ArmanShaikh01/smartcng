import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // bind to 0.0.0.0 — allows access via 127.0.0.1, localhost, and local network IP
  },
})

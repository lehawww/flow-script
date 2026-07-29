import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base so `npm run build` output can be opened straight off disk
  // (file://) or served from any subpath on the team's internal host.
  base: './',
  // No fixed port: nothing here depends on the origin (no OAuth callbacks,
  // webhooks or CORS), so honour PORT when the launcher assigns one and let
  // Vite pick a free port otherwise.
  server: { port: process.env.PORT ? Number(process.env.PORT) : undefined },
})

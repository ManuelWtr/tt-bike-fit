import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set this to your GitHub repo name so assets resolve at
// https://<user>.github.io/<REPO>/... when deployed to GitHub Pages.
// If you later move to a custom (sub)domain like bikefit.mnlwtr.com, set
// this to '/' (or remove the base option entirely).
const GH_PAGES_BASE = '/tt-bike-fit/'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? GH_PAGES_BASE : '/',
  server: {
    port: 5173,
    open: true,
  },
}))

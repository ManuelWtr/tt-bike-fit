import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` emits RELATIVE asset URLs in the built index.html. This means
// the same build works both at https://manuelwtr.github.io/tt-bike-fit/
// (project page URL) and at https://bikefit.mnlwtr.com/ (custom domain) —
// no rebuild needed when the custom domain DNS is wired up.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    open: true,
  },
})

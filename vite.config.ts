import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom domain bikefit.mnlwtr.com → base is '/'.
// If you ever drop the custom domain and go back to the github.io project
// URL, set this back to '/tt-bike-fit/'.
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    open: true,
  },
})

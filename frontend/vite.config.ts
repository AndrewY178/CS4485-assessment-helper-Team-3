import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // forward /api calls to the Flask backend during development
    proxy: {
      '/api': 'http://localhost:5001',
    },
  },
})

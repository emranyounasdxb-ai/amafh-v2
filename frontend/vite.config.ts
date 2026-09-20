import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(root, 'src') } },
  build: {
    rolldownOptions: {
      output: { codeSplitting: { groups: [
        { name: 'react-vendor', test: /node_modules[\\/](react|react-dom)[\\/]/ },
      ] } },
    },
  },
  server: {
    strictPort: true,
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000', changeOrigin: true },
      '/health': { target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000', changeOrigin: true },
    },
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
})

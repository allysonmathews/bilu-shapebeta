import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://76.13.235.137:3001',
        changeOrigin: true,
        secure: false,
        ws: true, // Suporta WebSocket se necessário
      },
    },
  },
  // Força o reload das variáveis de ambiente
  clearScreen: false,
})

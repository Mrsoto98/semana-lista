import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5176,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router'],
          'vendor-motion':   ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query':    ['@tanstack/react-query'],
          'vendor-charts':   ['recharts'],
          'vendor-canvas':   ['html2canvas'],
          'vendor-date':     ['date-fns'],
        },
      },
    },
  },
})

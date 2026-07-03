import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg'],
      manifest: {
        name: 'Semana Lista',
        short_name: 'Semana Lista',
        description: 'Planificador semanal de menús con IA y lista de la compra',
        theme_color: '#22c55e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        lang: 'es',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Solo cachea JS/CSS/assets con hash — nunca HTML para que las actualizaciones sean instantáneas
        globPatterns: ['**/*.{js,css,svg,woff2,png,ico}'],
        // Desactivar navigateFallback evita que el SW sirva index.html cacheado
        // — sin esto el móvil nunca ve la versión nueva hasta reinstalar la PWA
        navigateFallback: null,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})

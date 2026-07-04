import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

function buildVersionPlugin() {
  return {
    name: 'build-version',
    closeBundle() {
      const v = Date.now()
      fs.writeFileSync(path.resolve(__dirname, 'dist/version.json'), JSON.stringify({ v }))
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    buildVersionPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // Registro manual en index.html con updateViaCache:'none'
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
        // Solo cachea JS/CSS/assets con hash — NUNCA HTML.
        // El HTML lo sirve siempre Vercel (no-cache), así el SW viejo
        // nunca puede bloquear una actualización.
        globPatterns: ['**/*.{js,css,svg,woff2,png,ico}'],
        navigateFallback: null as unknown as string,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})

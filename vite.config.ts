import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'EmbrioGestor 2.0',
        short_name: 'EmbrioGestor',
        description: 'Gestão de produção in vitro de embriões bovinos',
        theme_color: '#0f3f5c',
        background_color: '#eef5f8',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: './',
        start_url: './',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({request}) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {cacheName:'embriogestor-pages',networkTimeoutSeconds:3}
          },
          {
            urlPattern: ({request}) => ['style','script','worker','image','font'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: {cacheName:'embriogestor-assets'}
          }
        ]
      }
    })
  ],
  server: { host: true },
  preview: { host: true }
})

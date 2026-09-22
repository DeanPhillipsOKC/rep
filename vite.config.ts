import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// See docs/architecture.md#pwa-configuration for the reasoning behind these settings.
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.ico'],
      manifest: {
        name: 'Workout Tracker',
        short_name: 'Workouts',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#111111',
        background_color: '#111111',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Caches the app shell so it loads without network — see the
        // "offline writes" note in docs/architecture.md. Runtime data
        // caching for Supabase requests is handled by the app's own
        // IndexedDB queue, not the service worker.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ]
})

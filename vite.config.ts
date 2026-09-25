import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { getBuildVersion } from './scripts/lib/build-version.mjs'

// See docs/architecture.md#pwa-configuration for the reasoning behind these settings.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(getBuildVersion())
  },
  plugins: [
    vue(),
    VitePWA({
      // injectManifest (rather than the default generateSW) so src/sw.ts can
      // hand-add a push/notificationclick handler for backlog item 15's rest
      // timer alerts — generateSW only lets you configure runtime caching,
      // not add arbitrary event listeners.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // The default auto-injected registerSW.js just calls
      // navigator.serviceWorker.register() once on load and does nothing
      // else — no periodic update checks, no SKIP_WAITING message, no
      // reload on activation. main.ts instead imports the real
      // virtual:pwa-register client, which does all of that; injecting
      // both would double-register the service worker.
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png', 'favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png'],
      manifest: {
        name: 'RepBunny',
        short_name: 'RepBunny',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#17111C',
        background_color: '#17111C',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      injectManifest: {
        // Caches the app shell so it loads without network — see the
        // "offline writes" note in docs/architecture.md. Runtime data
        // caching for Supabase requests is handled by the app's own
        // IndexedDB queue, not the service worker.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ]
})

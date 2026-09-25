import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import { router } from './router'
import './style.css'

document.title = `RepBunny ${__APP_VERSION__}`

// `immediate: true` registers the service worker right away instead of
// waiting for window 'load'. `registerType: 'autoUpdate'` (vite.config.ts)
// makes vite-plugin-pwa's client poll for an update and, once sw.ts's new
// worker is installed, post it SKIP_WAITING and reload the page on
// `controllerchange` — see sw.ts for why that message listener has to be
// hand-added under the injectManifest strategy. Without this, the app was
// stuck on whatever version was cached at install time until the user
// uninstalled and reinstalled it.
registerSW({ immediate: true })

createApp(App).use(createPinia()).use(router).mount('#app')

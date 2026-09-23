/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Injected by vite.config.ts via `define` — see scripts/lib/build-version.mjs
declare const __APP_VERSION__: string

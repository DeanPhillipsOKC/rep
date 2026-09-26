import { createClient } from '@supabase/supabase-js'

// Only the anon key belongs here — it's safe to ship to the browser because
// RLS (see supabase/policies.sql) is the actual authorization boundary.
// Never put the service_role key in client code. See docs/architecture.md#client-security.
//
// `experimental.passkey` opts into Supabase's passkey beta — see the
// "Authentication" section of docs/architecture.md for why we're taking
// that risk before the API is stable.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      experimental: { passkey: true },
    },
  }
)

// Item 84: lets the e2e suite (e2e/cross-account-switch.spec.ts) call
// `supabase.auth.setSession()` to swap the signed-in identity in place,
// mid-SPA-lifetime, the same way a real passkey sign-in does internally —
// there's no user-facing passkey to drive in a headless browser, and a
// page.goto/reload to simulate the switch would reset every Pinia store on
// its own, defeating the point of a test for a same-session account-switch
// bug. `import.meta.env.DEV` is compiled away by Vite's production build
// (`npm run build`); only `npm run dev`, which the e2e webServer runs, has
// it true, so this never exists outside a local/CI test run.
if (import.meta.env.DEV) {
  (window as unknown as { __e2eSupabase?: typeof supabase }).__e2eSupabase = supabase
}

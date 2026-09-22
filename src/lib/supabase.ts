import { createClient } from '@supabase/supabase-js'

// Only the anon key belongs here — it's safe to ship to the browser because
// RLS (see supabase/policies.sql) is the actual authorization boundary.
// Never put the service_role key in client code. See docs/architecture.md#client-security.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

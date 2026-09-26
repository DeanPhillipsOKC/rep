import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Enrollment flow per docs/architecture.md#authentication:
// 1. magic link establishes the account
// 2. immediately prompt to register a passkey
// 3. passkey is the primary path from then on; magic link stays as recovery
export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const loading = ref(true)
  const hasPasskey = ref(false)

  const isSignedIn = computed(() => session.value !== null)

  // Item 84: bumped only when the signed-in identity itself changes (sign
  // out, sign in, or switching accounts on the same device) — not on a
  // same-user TOKEN_REFRESHED. Account-scoped fetches that are still in
  // flight when this happens (e.g. workouts.ts's fetchProgressStats,
  // triggered by the previous account's Home mount) capture the epoch
  // before their await and discard their result if it's since moved on,
  // so a slow response from the old account can't land on top of the new
  // one's freshly-fetched (and correctly empty) data.
  const sessionEpoch = ref(0)
  let lastUserId: string | null = null

  async function refreshPasskeyStatus() {
    if (!session.value) {
      hasPasskey.value = false
      return
    }
    const { data, error } = await supabase.auth.passkey.list()
    hasPasskey.value = !error && !!data && data.length > 0
  }

  // exercises/workouts have an FK to profiles(id) (see docs/architecture.md#data-model).
  // Pre-created auth users don't get a profiles row for free, so ensure one exists
  // on every sign-in — cheap no-op once it's there.
  async function ensureProfile() {
    if (!session.value) return
    await supabase.from('profiles').upsert({ id: session.value.user.id })
  }

  async function init() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    lastUserId = data.session?.user.id ?? null
    await ensureProfile()
    await refreshPasskeyStatus()
    loading.value = false

    supabase.auth.onAuthStateChange((_event, newSession) => {
      const newUserId = newSession?.user.id ?? null
      if (newUserId !== lastUserId) {
        sessionEpoch.value += 1
        lastUserId = newUserId
      }
      session.value = newSession
      ensureProfile()
      refreshPasskeyStatus()
    })
  }

  async function sendMagicLink(email: string) {
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
  }

  async function registerPasskey() {
    const result = await supabase.auth.registerPasskey()
    await refreshPasskeyStatus()
    return result
  }

  function supportsPasskeys(): boolean {
    return typeof window !== 'undefined' && window.PublicKeyCredential !== undefined
  }

  async function signInWithPasskey() {
    return supabase.auth.signInWithPasskey()
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return {
    session,
    loading,
    hasPasskey,
    isSignedIn,
    sessionEpoch,
    init,
    sendMagicLink,
    registerPasskey,
    signInWithPasskey,
    supportsPasskeys,
    signOut,
  }
})

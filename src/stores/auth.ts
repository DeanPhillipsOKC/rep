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

  async function refreshPasskeyStatus() {
    if (!session.value) {
      hasPasskey.value = false
      return
    }
    const { data, error } = await supabase.auth.passkey.list()
    hasPasskey.value = !error && !!data && data.length > 0
  }

  async function init() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    await refreshPasskeyStatus()
    loading.value = false

    supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession
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
    init,
    sendMagicLink,
    registerPasskey,
    signInWithPasskey,
    supportsPasskeys,
    signOut,
  }
})

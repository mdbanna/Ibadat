import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { memberIdToAuthEmail, normalizeMemberId } from './memberAuth'
import { fetchOwnProfile, type MemberProfile } from './member'
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Member authentication.
 *
 * Identity is proven ONLY by Supabase Auth (password -> JWT). A Member ID is never trusted by itself: it is mapped to the
 * Auth email "ibd-0001@<domain>", the password is checked by Supabase, and afterwards the signed-in user's own profile
 * (read through RLS) must carry exactly the Member ID that was typed. The database also enforces that binding
 * (migration 20261012000100), so a profile cannot exist for a different Auth account than its Member ID.
 *
 * Roles/active status are never taken from the browser: they are read from the database on every sign-in and the
 * members-only data itself is protected by RLS, so tampering with this state in the browser unlocks nothing.
 */

export type AuthStatus = 'loading' | 'unconfigured' | 'signed_out' | 'checking' | 'ready'
export type Access = 'active' | 'inactive' | 'no_profile' | 'error'
export type AuthNotice = 'loggedOut' | 'sessionExpired' | null

export type SignInOutcome =
  | { ok: true; access: Access }
  | { ok: false; reason: 'invalid_member_id' | 'invalid_credentials' | 'rate_limited' | 'network' | 'unavailable' }

export interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  profile: MemberProfile | null
  access: Access | null
  notice: AuthNotice
  signIn: (memberId: string, password: string) => Promise<SignInOutcome>
  signOut: () => Promise<void>
  setProfile: (profile: MemberProfile) => void
  refreshProfile: () => void
  clearNotice: () => void
}

const noop = async () => undefined
const SIGNED_OUT: AuthContextValue = {
  status: 'signed_out', session: null, profile: null, access: null, notice: null,
  signIn: async () => ({ ok: false, reason: 'unavailable' }), signOut: noop, setProfile: () => undefined, refreshProfile: () => undefined, clearNotice: () => undefined,
}
/** Default value lets public pages render without a provider (e.g. in isolated tests). */
const AuthContext = createContext<AuthContextValue>(SIGNED_OUT)
export const useAuth = () => useContext(AuthContext)

export function accessFor(profile: MemberProfile | null): Access {
  if (!profile) return 'no_profile'
  return profile.membership_status === 'active' ? 'active' : 'inactive'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'unconfigured')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfileState] = useState<MemberProfile | null>(null)
  const [access, setAccess] = useState<Access | null>(null)
  const [notice, setNotice] = useState<AuthNotice>(null)
  const userInitiatedSignOut = useRef(false)
  const hadSession = useRef(false)
  const loadedFor = useRef<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  // 1) restore the persisted session and follow Supabase's auth events (refresh, sign-out in another tab, expiry)
  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      hadSession.current = Boolean(data.session)
      setSession(data.session)
      if (!data.session) setStatus('signed_out')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Do not call Supabase APIs inside this callback (documented deadlock); only update state here.
      if (event === 'SIGNED_OUT') {
        setNotice(userInitiatedSignOut.current ? 'loggedOut' : hadSession.current ? 'sessionExpired' : null)
        userInitiatedSignOut.current = false
        hadSession.current = false
        loadedFor.current = null
        setSession(null); setProfileState(null); setAccess(null); setStatus('signed_out')
        return
      }
      if (next) { hadSession.current = true; setSession(next) }
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  // 2) whenever the signed-in user changes, load THEIR profile (RLS) and decide whether the dashboard may open
  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!userId) return
    if (loadedFor.current === userId && reloadNonce === 0) return // signIn() already verified this profile
    let current = true
    setStatus('checking')
    fetchOwnProfile(userId).then(
      (p) => { if (current) { setProfileState(p); setAccess(accessFor(p)); setStatus('ready') } },
      () => { if (current) { setProfileState(null); setAccess('error'); setStatus('ready') } },
    )
    loadedFor.current = userId
    return () => { current = false }
  }, [userId, reloadNonce])

  const signIn = useCallback<AuthContextValue['signIn']>(async (memberIdInput, password) => {
    const domain = import.meta.env.VITE_MEMBER_AUTH_EMAIL_DOMAIN
    if (!supabase || !domain) return { ok: false, reason: 'unavailable' }
    const memberId = normalizeMemberId(memberIdInput)
    const email = memberId ? memberIdToAuthEmail(memberId, domain) : null
    if (!memberId || !email) return { ok: false, reason: 'invalid_member_id' }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.user) {
        if (error?.status === 429) return { ok: false, reason: 'rate_limited' }
        if (error?.status === 400 || error?.status === 401 || error?.status === 422) return { ok: false, reason: 'invalid_credentials' }
        return { ok: false, reason: 'network' }
      }
      // Never trust the typed Member ID alone: the account that just authenticated must own exactly that Member ID.
      let own: MemberProfile | null = null
      try { own = await fetchOwnProfile(data.user.id) } catch { /* handled below */ }
      if (!own || own.member_id !== memberId) {
        userInitiatedSignOut.current = false
        await supabase.auth.signOut({ scope: 'local' })
        return { ok: false, reason: own ? 'invalid_credentials' : 'unavailable' }
      }
      loadedFor.current = data.user.id
      hadSession.current = true
      setSession(data.session); setProfileState(own); setAccess(accessFor(own)); setStatus('ready'); setNotice(null)
      return { ok: true, access: accessFor(own) }
    } catch {
      return { ok: false, reason: 'network' }
    }
  }, [])

  const signOut = useCallback(async () => {
    userInitiatedSignOut.current = true
    try { await supabase?.auth.signOut({ scope: 'local' }) } catch { /* local state is cleared below regardless */ }
    // signOut() clears local storage even if the network call fails; make sure the UI follows.
    loadedFor.current = null
    setSession(null); setProfileState(null); setAccess(null); setStatus('signed_out'); setNotice('loggedOut')
    userInitiatedSignOut.current = false; hadSession.current = false
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    status, session, profile, access, notice, signIn, signOut,
    setProfile: (p) => { setProfileState(p); setAccess(accessFor(p)) },
    refreshProfile: () => setReloadNonce((n) => n + 1),
    clearNotice: () => setNotice(null),
  }), [status, session, profile, access, notice, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Only same-site dashboard paths are accepted as a post-login destination (prevents open redirects). */
export function safeNext(next: string | null | undefined): string {
  if (!next) return '/dashboard'
  // each segment must be non-empty and must not start with '.', which rules out '//' and '..' tricks
  if (!/^\/dashboard(\/[A-Za-z0-9_~-][A-Za-z0-9._~-]*)*$/.test(next)) return '/dashboard'
  return next
}

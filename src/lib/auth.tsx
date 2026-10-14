import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { loginEmailFor, requestFirstLoginChange, type FirstLoginOutcome } from './memberAuth'
import { fetchOwnProfile, fetchOwnRoles, type MemberProfile } from './member'
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Member authentication (phone number + password).
 *
 * Identity is proven ONLY by Supabase Auth (password -> JWT). A phone number is never trusted by itself: it is mapped to the
 * Auth email "8801712345678@<domain>", the password is checked by Supabase, and afterwards the signed-in user's own profile
 * (read through RLS) must carry exactly that phone number. The database enforces the same binding (profiles_bind_phone).
 *
 * The first password is the phone number itself. While profile.must_change_password is true the member can only reach the
 * "set a new password" page, and the DATABASE withholds members-only data too (is_active_member() is false), so tampering with
 * this state in the browser unlocks nothing. Roles/active status are read from the database at every sign-in.
 */

export type AuthStatus = 'loading' | 'unconfigured' | 'signed_out' | 'checking' | 'ready'
export type Access = 'active' | 'inactive' | 'no_profile' | 'error'
export type AuthNotice = 'loggedOut' | 'sessionExpired' | null

export type SignInOutcome =
  | { ok: true; access: Access; mustChangePassword: boolean }
  | { ok: false; reason: 'invalid_phone' | 'invalid_credentials' | 'rate_limited' | 'network' | 'unavailable' }

export interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  profile: MemberProfile | null
  access: Access | null
  roles: string[]
  isAdmin: boolean
  mustChangePassword: boolean
  notice: AuthNotice
  signIn: (phone: string, password: string) => Promise<SignInOutcome>
  signOut: () => Promise<void>
  completeFirstLogin: (newPassword: string) => Promise<FirstLoginOutcome>
  setProfile: (profile: MemberProfile) => void
  refreshProfile: () => void
  clearNotice: () => void
}

const noop = async () => undefined
const SIGNED_OUT: AuthContextValue = {
  status: 'signed_out', session: null, profile: null, access: null, roles: [], isAdmin: false, mustChangePassword: false, notice: null,
  signIn: async () => ({ ok: false, reason: 'unavailable' }), signOut: noop, completeFirstLogin: async () => ({ ok: false, reason: 'unavailable' }),
  setProfile: () => undefined, refreshProfile: () => undefined, clearNotice: () => undefined,
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
  const [roles, setRoles] = useState<string[]>([])
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
        setSession(null); setProfileState(null); setAccess(null); setRoles([]); setStatus('signed_out')
        return
      }
      if (next) { hadSession.current = true; setSession(next) }
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  // 2) whenever the signed-in user changes, load THEIR profile and roles (RLS) and decide what they may open
  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!userId) return
    if (loadedFor.current === userId && reloadNonce === 0) return // signIn() already verified this profile
    let current = true
    setStatus('checking')
    Promise.all([fetchOwnProfile(userId), fetchOwnRoles(userId).catch(() => [] as string[])]).then(
      ([p, r]) => { if (current) { setProfileState(p); setRoles(r); setAccess(accessFor(p)); setStatus('ready') } },
      () => { if (current) { setProfileState(null); setRoles([]); setAccess('error'); setStatus('ready') } },
    )
    loadedFor.current = userId
    return () => { current = false }
  }, [userId, reloadNonce])

  const signIn = useCallback<AuthContextValue['signIn']>(async (phoneInput, password) => {
    const login = loginEmailFor(phoneInput, import.meta.env.VITE_MEMBER_AUTH_EMAIL_DOMAIN)
    if (!supabase || !import.meta.env.VITE_MEMBER_AUTH_EMAIL_DOMAIN) return { ok: false, reason: 'unavailable' }
    if (!login) return { ok: false, reason: 'invalid_phone' }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: login.email, password })
      if (error || !data.user) {
        if (error?.status === 429) return { ok: false, reason: 'rate_limited' }
        if (error?.status === 400 || error?.status === 401 || error?.status === 422) return { ok: false, reason: 'invalid_credentials' }
        return { ok: false, reason: 'network' }
      }
      // Never trust the typed phone alone: the account that just authenticated must own exactly that phone number.
      let own: MemberProfile | null = null
      let ownRoles: string[] = []
      try { [own, ownRoles] = await Promise.all([fetchOwnProfile(data.user.id), fetchOwnRoles(data.user.id).catch(() => [] as string[])]) } catch { /* handled below */ }
      if (!own || own.phone !== login.phone) {
        userInitiatedSignOut.current = false
        await supabase.auth.signOut({ scope: 'local' })
        return { ok: false, reason: own ? 'invalid_credentials' : 'unavailable' }
      }
      loadedFor.current = data.user.id
      hadSession.current = true
      setSession(data.session); setProfileState(own); setRoles(ownRoles); setAccess(accessFor(own)); setStatus('ready'); setNotice(null)
      return { ok: true, access: accessFor(own), mustChangePassword: own.must_change_password }
    } catch {
      return { ok: false, reason: 'network' }
    }
  }, [])

  const signOut = useCallback(async () => {
    userInitiatedSignOut.current = true
    try { await supabase?.auth.signOut({ scope: 'local' }) } catch { /* local state is cleared below regardless */ }
    loadedFor.current = null
    setSession(null); setProfileState(null); setAccess(null); setRoles([]); setStatus('signed_out'); setNotice('loggedOut')
    userInitiatedSignOut.current = false; hadSession.current = false
  }, [])

  /** First-login password change: the Edge Function changes the password and clears the flag; then we sign in again with the new password. */
  const completeFirstLogin = useCallback<AuthContextValue['completeFirstLogin']>(async (newPassword) => {
    const result = await requestFirstLoginChange(newPassword)
    if (!result.ok || !supabase || !profile) return result
    const login = loginEmailFor(profile.phone, import.meta.env.VITE_MEMBER_AUTH_EMAIL_DOMAIN)
    if (login) await supabase.auth.signInWithPassword({ email: login.email, password: newPassword }).catch(() => undefined)
    setReloadNonce((n) => n + 1)
    return result
  }, [profile])

  const value = useMemo<AuthContextValue>(() => ({
    status, session, profile, access, roles, isAdmin: roles.includes('admin'),
    mustChangePassword: Boolean(profile?.must_change_password), notice, signIn, signOut, completeFirstLogin,
    setProfile: (p) => { setProfileState(p); setAccess(accessFor(p)) },
    refreshProfile: () => setReloadNonce((n) => n + 1),
    clearNotice: () => setNotice(null),
  }), [status, session, profile, access, roles, notice, signIn, signOut, completeFirstLogin])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Only same-site dashboard paths are accepted as a post-login destination (prevents open redirects). */
export function safeNext(next: string | null | undefined): string {
  if (!next) return '/dashboard'
  // each segment must be non-empty and must not start with '.', which rules out '//' and '..' tricks
  if (!/^\/dashboard(\/[A-Za-z0-9_~-][A-Za-z0-9._~-]*)*$/.test(next)) return '/dashboard'
  return next
}

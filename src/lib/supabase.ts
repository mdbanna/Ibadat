import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** True only when both PUBLIC variables are present. Says nothing about whether the project is reachable. */
export const isSupabaseConfigured = Boolean(url && publishableKey)

export type TypedSupabaseClient = SupabaseClient<Database>

export const supabase: TypedSupabaseClient | null = isSupabaseConfigured
  ? createClient<Database>(url as string, publishableKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null

export function requireSupabase(): TypedSupabaseClient {
  if (!supabase) throw new Error('supabase_not_configured')
  return supabase
}

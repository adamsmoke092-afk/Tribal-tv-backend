import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type AdminAccessResult =
  | { status: 'signed-out' }
  | { status: 'not-admin'; user: User }
  | { status: 'admin'; user: User }

/**
 * 1. supabase.auth.getUser() validates the session with the Auth server (it does
 *    not just trust the token stored in the browser).
 * 2. public.is_current_user_admin() asks the database whether THIS authenticated
 *    user is on the admin allow-list. It accepts no user id and returns only a boolean.
 *
 * This is a UI gate only. Row Level Security remains the real enforcement for
 * every read and write.
 */
export async function checkAdminAccess(): Promise<AdminAccessResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { status: 'signed-out' }
  }

  const { data, error } = await supabase.rpc('is_current_user_admin')

  if (error) {
    throw new Error('Admin permission could not be verified. Check the database connection and try again.')
  }

  return data === true ? { status: 'admin', user } : { status: 'not-admin', user }
}

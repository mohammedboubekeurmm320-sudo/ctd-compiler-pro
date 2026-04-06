// ============================================================
// M23 — Hook useAuth
// Expose user, profile, role, tenant_id
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types'

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  role: UserRole | null
  tenantId: string | null
  isSuperAdmin: boolean
  isAdmin: boolean
  isApprover: boolean
  isReviewer: boolean
  isRedactor: boolean
  canEdit: boolean       // redactor | admin
  canReview: boolean     // reviewer | admin
  canApprove: boolean    // approver | admin
  canExport: boolean     // approver | admin
  canManageUsers: boolean // admin | super_admin
}

const INITIAL_STATE: AuthState = {
  user: null,
  profile: null,
  session: null,
  loading: true,
  role: null,
  tenantId: null,
  isSuperAdmin: false,
  isAdmin: false,
  isApprover: false,
  isReviewer: false,
  isRedactor: false,
  canEdit: false,
  canReview: false,
  canApprove: false,
  canExport: false,
  canManageUsers: false,
}

function derivePermissions(role: UserRole | null): Partial<AuthState> {
  if (!role) return {}
  return {
    isSuperAdmin: role === 'super_admin',
    isAdmin: role === 'admin',
    isApprover: role === 'approver',
    isReviewer: role === 'reviewer',
    isRedactor: role === 'redactor',
    canEdit: ['redactor', 'admin'].includes(role),
    canReview: ['reviewer', 'admin'].includes(role),
    canApprove: ['approver', 'admin'].includes(role),
    canExport: ['approver', 'admin'].includes(role),
    canManageUsers: ['admin', 'super_admin'].includes(role),
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(INITIAL_STATE)

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('useAuth: erreur chargement profil', error)
      return null
    }
    return data as Profile
  }, [])

  useEffect(() => {
    // Session initiale
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setState({
          ...INITIAL_STATE,
          user: session.user,
          session,
          profile,
          loading: false,
          role: profile?.role ?? null,
          tenantId: profile?.tenant_id ?? null,
          ...derivePermissions(profile?.role ?? null),
        })
      } else {
        setState({ ...INITIAL_STATE, loading: false })
      }
    })

    // Écoute les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          setState({
            ...INITIAL_STATE,
            user: session.user,
            session,
            profile,
            loading: false,
            role: profile?.role ?? null,
            tenantId: profile?.tenant_id ?? null,
            ...derivePermissions(profile?.role ?? null),
          })
        } else {
          setState({ ...INITIAL_STATE, loading: false })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }, [])

  return { ...state, signIn, signOut, resetPassword }
}

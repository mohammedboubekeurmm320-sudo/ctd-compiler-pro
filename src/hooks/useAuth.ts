// ============================================================
// M23 — Hook useAuth (VERSION DÉBOGAGE)
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
  canEdit: boolean
  canReview: boolean
  canApprove: boolean
  canExport: boolean
  canManageUsers: boolean
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
    console.log('🔹 [fetchProfile] Début pour user:', userId)
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    console.log('🔹 [fetchProfile] Résultat:', { 
      hasData: !!data, 
      error: error?.message || null 
    })

    if (error) {
      console.error('🔴 [fetchProfile] Erreur:', error)
      return null
    }
    return data as Profile
  }, [])

  // Fonction utilitaire pour mettre à jour l'état
  const updateStateFromSession = useCallback(async (session: Session | null) => {
    console.log('🔹 [updateState] Session:', session?.user?.email || 'null')
    
    if (session?.user) {
      const profile = await fetchProfile(session.user.id)
      console.log('🔹 [updateState] Profil chargé:', profile?.role || 'null')
      
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
      console.log('🔹 [updateState] Pas de session, état réinitialisé')
      setState({ ...INITIAL_STATE, loading: false })
    }
  }, [fetchProfile])

  useEffect(() => {
    console.log('🔹 [useAuth] useEffect démarré')
    
    // Session initiale
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('🔹 [useAuth] getSession:', session?.user?.email || 'null')
      await updateStateFromSession(session)
    })

    // Écoute les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔹 [useAuth] onAuthStateChange:', event)
        await updateStateFromSession(session)
      }
    )

    return () => {
      console.log('🔹 [useAuth] Cleanup subscription')
      subscription.unsubscribe()
    }
  }, [updateStateFromSession])

  const signIn = useCallback(async (email: string, password: string) => {
    console.log('🔐 [signIn] Début avec email:', email)
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    console.log('🔐 [signIn] Résultat auth:', { 
      hasUser: !!data?.user, 
      error: error?.message || null 
    })
    
    if (error) {
      console.error('🔴 [signIn] Erreur Supabase:', error)
      throw error
    }
    
    // ⚠️ Attendre que l'état soit mis à jour avant de retourner
    // On poll l'état jusqu'à ce que loading soit false
    return new Promise<void>((resolve, reject) => {
      const checkState = () => {
        if (!state.loading) {
          console.log('🔐 [signIn] État mis à jour, résolution')
          resolve()
        } else {
          setTimeout(checkState, 100)
        }
      }
      checkState()
      
      // Timeout de sécurité
      setTimeout(() => {
        console.warn('⚠️ [signIn] Timeout atteint')
        resolve() // On résout quand même pour ne pas bloquer l'UI
      }, 5000)
    })
  }, [state.loading])

  const signOut = useCallback(async () => {
    console.log('🔐 [signOut] Déconnexion')
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

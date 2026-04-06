// ============================================================
// Store auth — état global d'authentification
// ============================================================

import { create } from 'zustand'
import type { Profile, UserRole } from '@/types'

interface AuthStore {
  profile: Profile | null
  role: UserRole | null
  tenantId: string | null
  setProfile: (profile: Profile | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthStore>(set => ({
  profile: null,
  role: null,
  tenantId: null,
  setProfile: (profile) => set({
    profile,
    role: profile?.role ?? null,
    tenantId: profile?.tenant_id ?? null,
  }),
  clear: () => set({ profile: null, role: null, tenantId: null }),
}))

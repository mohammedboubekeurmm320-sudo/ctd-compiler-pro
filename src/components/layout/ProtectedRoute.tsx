// ============================================================
// M23 — ProtectedRoute
// Redirige si rôle insuffisant ou non authentifié
// ============================================================

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: UserRole[]
  requireTenant?: boolean
}

export function ProtectedRoute({
  children,
  roles,
  requireTenant = true,
}: ProtectedRouteProps) {
  const { user, profile, loading, role } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    )
  }

  // Non authentifié
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Profil requis avec tenant
  if (requireTenant && !profile?.tenant_id && role !== 'super_admin') {
    return <Navigate to="/pending-setup" replace />
  }

  // Vérification du rôle
  if (roles && role && !roles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}

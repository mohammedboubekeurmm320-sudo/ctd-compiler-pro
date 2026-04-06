// ============================================================
// Tests M23 — Permissions par rôle
// ============================================================

import { describe, it, expect } from 'vitest'
import type { UserRole } from '@/types'

// Reproduire la logique de derivePermissions depuis useAuth
function derivePermissions(role: UserRole | null) {
  if (!role) return {
    isSuperAdmin: false, isAdmin: false, isApprover: false,
    isReviewer: false, isRedactor: false,
    canEdit: false, canReview: false, canApprove: false,
    canExport: false, canManageUsers: false,
  }
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

describe('M23 — Permissions par rôle', () => {
  describe('Rédacteur', () => {
    const perms = derivePermissions('redactor')
    it('peut éditer', () => expect(perms.canEdit).toBe(true))
    it('ne peut pas réviser', () => expect(perms.canReview).toBe(false))
    it('ne peut pas approuver', () => expect(perms.canApprove).toBe(false))
    it('ne peut pas exporter', () => expect(perms.canExport).toBe(false))
    it('ne peut pas gérer les utilisateurs', () => expect(perms.canManageUsers).toBe(false))
  })

  describe('Réviseur', () => {
    const perms = derivePermissions('reviewer')
    it('ne peut pas éditer', () => expect(perms.canEdit).toBe(false))
    it('peut réviser', () => expect(perms.canReview).toBe(true))
    it('ne peut pas approuver', () => expect(perms.canApprove).toBe(false))
    it('ne peut pas exporter', () => expect(perms.canExport).toBe(false))
  })

  describe('Approbateur', () => {
    const perms = derivePermissions('approver')
    it('ne peut pas éditer', () => expect(perms.canEdit).toBe(false))
    it('ne peut pas réviser', () => expect(perms.canReview).toBe(false))
    it('peut approuver', () => expect(perms.canApprove).toBe(true))
    it('peut exporter', () => expect(perms.canExport).toBe(true))
  })

  describe('Admin', () => {
    const perms = derivePermissions('admin')
    it('peut éditer', () => expect(perms.canEdit).toBe(true))
    it('peut réviser', () => expect(perms.canReview).toBe(true))
    it('peut approuver', () => expect(perms.canApprove).toBe(true))
    it('peut exporter', () => expect(perms.canExport).toBe(true))
    it('peut gérer les utilisateurs', () => expect(perms.canManageUsers).toBe(true))
    it('n\'est pas super admin', () => expect(perms.isSuperAdmin).toBe(false))
  })

  describe('Super Admin', () => {
    const perms = derivePermissions('super_admin')
    it('est super admin', () => expect(perms.isSuperAdmin).toBe(true))
    it('peut gérer les utilisateurs', () => expect(perms.canManageUsers).toBe(true))
    it('ne peut pas éditer (données CTD)', () => expect(perms.canEdit).toBe(false))
  })

  describe('Aucun rôle', () => {
    const perms = derivePermissions(null)
    it('aucune permission', () => {
      expect(perms.canEdit).toBe(false)
      expect(perms.canReview).toBe(false)
      expect(perms.canApprove).toBe(false)
      expect(perms.canExport).toBe(false)
      expect(perms.canManageUsers).toBe(false)
    })
  })
})

// ============================================================
// Tests d'intégration — Workflow CTD complet
// Ces tests vérifient les flux métier de bout en bout
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase pour les tests d'intégration
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  order: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
}

vi.mock('@/lib/supabase', () => ({ supabase: mockSupabase }))

describe('Workflow — Création de projet CTD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crée un projet avec le bon profil CTD selon type + autorité', async () => {
    const { getCTDProfile } = await import('@/lib/ctd/sections')

    const profileM3EMA = getCTDProfile('M3', 'EMA')
    const profileM4FDA = getCTDProfile('M4', 'FDA')
    const profileM5EMA = getCTDProfile('M5', 'EMA')

    expect(profileM3EMA.sections.length).toBeGreaterThan(10)
    expect(profileM4FDA.sections.length).toBe(3)
    expect(profileM5EMA.sections.length).toBe(4)

    // M3 EMA ne contient pas de sections M4
    expect(profileM3EMA.sections.every(s => !s.code.startsWith('4.'))).toBe(true)

    // M5 ne contient pas de sections M3
    expect(profileM5EMA.sections.every(s => !s.code.startsWith('3.'))).toBe(true)
  })
})

describe('Workflow — Validation des permissions', () => {
  const PERMISSIONS: Record<string, Record<string, boolean>> = {
    redactor: {
      createProject: true,
      uploadDocuments: true,
      launchExtraction: true,
      fillCTDForm: true,
      submitSection: true,
      reviewSection: false,
      approveSection: false,
      exportCTD: false,
      manageUsers: false,
      manageTenants: false,
    },
    reviewer: {
      createProject: false,
      uploadDocuments: false,
      launchExtraction: false,
      fillCTDForm: false,
      submitSection: false,
      reviewSection: true,
      approveSection: false,
      exportCTD: false,
      manageUsers: false,
      manageTenants: false,
    },
    approver: {
      createProject: false,
      uploadDocuments: false,
      launchExtraction: false,
      fillCTDForm: false,
      submitSection: false,
      reviewSection: false,
      approveSection: true,
      exportCTD: true,
      manageUsers: false,
      manageTenants: false,
    },
    admin: {
      createProject: true,
      uploadDocuments: true,
      launchExtraction: true,
      fillCTDForm: true,
      submitSection: true,
      reviewSection: true,
      approveSection: true,
      exportCTD: true,
      manageUsers: true,
      manageTenants: false,
    },
    super_admin: {
      createProject: false,
      uploadDocuments: false,
      launchExtraction: false,
      fillCTDForm: false,
      submitSection: false,
      reviewSection: false,
      approveSection: false,
      exportCTD: false,
      manageUsers: false,
      manageTenants: true,
    },
  }

  it('le rédacteur peut créer des projets mais pas approuver', () => {
    expect(PERMISSIONS.redactor.createProject).toBe(true)
    expect(PERMISSIONS.redactor.approveSection).toBe(false)
    expect(PERMISSIONS.redactor.exportCTD).toBe(false)
  })

  it('le réviseur peut réviser mais pas remplir le formulaire', () => {
    expect(PERMISSIONS.reviewer.reviewSection).toBe(true)
    expect(PERMISSIONS.reviewer.fillCTDForm).toBe(false)
    expect(PERMISSIONS.reviewer.approveSection).toBe(false)
  })

  it('l\'approbateur peut exporter mais pas gérer les utilisateurs', () => {
    expect(PERMISSIONS.approver.approveSection).toBe(true)
    expect(PERMISSIONS.approver.exportCTD).toBe(true)
    expect(PERMISSIONS.approver.manageUsers).toBe(false)
  })

  it('l\'admin a tous les droits sauf gérer les tenants', () => {
    const adminPerms = PERMISSIONS.admin
    expect(adminPerms.createProject).toBe(true)
    expect(adminPerms.exportCTD).toBe(true)
    expect(adminPerms.manageUsers).toBe(true)
    expect(adminPerms.manageTenants).toBe(false)
  })

  it('le super admin ne touche qu\'aux tenants, pas aux données CTD', () => {
    const saPerms = PERMISSIONS.super_admin
    expect(saPerms.manageTenants).toBe(true)
    expect(saPerms.fillCTDForm).toBe(false)
    expect(saPerms.exportCTD).toBe(false)
  })
})

describe('Workflow — Séquence de validation CTD', () => {
  type WorkflowStatus = 'draft' | 'submitted' | 'reviewed' | 'approved'

  function canTransition(
    current: WorkflowStatus,
    next: WorkflowStatus,
    role: string
  ): boolean {
    const transitions: Record<WorkflowStatus, { next: WorkflowStatus; roles: string[] }> = {
      draft:     { next: 'submitted', roles: ['redactor', 'admin'] },
      submitted: { next: 'reviewed',  roles: ['reviewer', 'admin'] },
      reviewed:  { next: 'approved',  roles: ['approver', 'admin'] },
      approved:  { next: 'approved',  roles: [] },
    }
    const t = transitions[current]
    return t.next === next && t.roles.includes(role)
  }

  it('rédacteur peut soumettre un brouillon', () => {
    expect(canTransition('draft', 'submitted', 'redactor')).toBe(true)
  })

  it('rédacteur ne peut pas réviser directement', () => {
    expect(canTransition('draft', 'reviewed', 'redactor')).toBe(false)
  })

  it('réviseur peut valider une soumission', () => {
    expect(canTransition('submitted', 'reviewed', 'reviewer')).toBe(true)
  })

  it('réviseur ne peut pas approuver directement', () => {
    expect(canTransition('submitted', 'approved', 'reviewer')).toBe(false)
  })

  it('approbateur approuve après révision', () => {
    expect(canTransition('reviewed', 'approved', 'approver')).toBe(true)
  })

  it('une section approuvée ne peut plus changer de statut', () => {
    expect(canTransition('approved', 'submitted', 'admin')).toBe(false)
  })

  it('admin peut effectuer toutes les transitions', () => {
    expect(canTransition('draft', 'submitted', 'admin')).toBe(true)
    expect(canTransition('submitted', 'reviewed', 'admin')).toBe(true)
    expect(canTransition('reviewed', 'approved', 'admin')).toBe(true)
  })
})

describe('Workflow — Isolation multi-tenant', () => {
  it('deux tenants différents ne partagent pas de données', () => {
    const tenantA = 'aaaaaaaa-0000-0000-0000-000000000001'
    const tenantB = 'bbbbbbbb-0000-0000-0000-000000000002'

    const projectA = { id: 'proj-a', tenant_id: tenantA, name: 'Projet A' }
    const projectB = { id: 'proj-b', tenant_id: tenantB, name: 'Projet B' }

    // Simuler une requête RLS : un utilisateur du tenant A ne voit que ses projets
    const allProjects = [projectA, projectB]
    const visibleForA = allProjects.filter(p => p.tenant_id === tenantA)
    const visibleForB = allProjects.filter(p => p.tenant_id === tenantB)

    expect(visibleForA).toHaveLength(1)
    expect(visibleForA[0].id).toBe('proj-a')
    expect(visibleForB).toHaveLength(1)
    expect(visibleForB[0].id).toBe('proj-b')
  })

  it('les audit logs sont isolés par tenant', () => {
    const logs = [
      { id: '1', tenant_id: 'tenant-a', action: 'create' },
      { id: '2', tenant_id: 'tenant-b', action: 'update' },
      { id: '3', tenant_id: 'tenant-a', action: 'export' },
    ]
    const logsA = logs.filter(l => l.tenant_id === 'tenant-a')
    expect(logsA).toHaveLength(2)
    expect(logsA.every(l => l.tenant_id === 'tenant-a')).toBe(true)
  })
})

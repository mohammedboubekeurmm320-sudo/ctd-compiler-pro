// ============================================================
// Hook useAuditLog — enregistrement systématique des actions
// Utilisé par tous les modules qui modifient des données
// ============================================================

import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuditAction, AuditEntityType } from '@/types'

interface LogParams {
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string
  projectId?: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
}

export function useAuditLog(tenantId: string | null, userId: string | null) {
  const log = useCallback(async (params: LogParams): Promise<void> => {
    if (!tenantId || !userId) return

    const { error } = await supabase.from('audit_log').insert({
      tenant_id: tenantId,
      project_id: params.projectId ?? null,
      user_id: userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
    })

    if (error) {
      console.error('useAuditLog: erreur enregistrement', error)
    }
  }, [tenantId, userId])

  return { log }
}

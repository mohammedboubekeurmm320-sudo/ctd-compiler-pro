// ============================================================
// Hook useConflicts — conflits d'un projet CTD
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Conflict } from '@/types'

export function useConflicts(projectId: string | undefined) {
  const { tenantId } = useAuth()
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async (id: string) => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('conflicts')
      .select('*')
      .eq('project_id', id)
      .eq('tenant_id', tenantId)
      .eq('resolved', false)
      .order('created_at', { ascending: false })
    setConflicts((data ?? []) as Conflict[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    if (projectId) fetch(projectId)
  }, [projectId, fetch])

  const resolveConflict = useCallback(async (
    conflictId: string,
    chosenExtractionId: string,
    resolvedBy: string,
    annotation?: string
  ) => {
    const { error } = await supabase
      .from('conflicts')
      .update({
        resolved: true,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
        chosen_extraction_id: chosenExtractionId,
        annotation: annotation ?? null,
      })
      .eq('id', conflictId)

    if (!error) {
      setConflicts(prev => prev.filter(c => c.id !== conflictId))
    }
    return error
  }, [])

  const blockingCount = conflicts.filter(c => c.conflict_type === 'blocking').length
  const warningCount  = conflicts.filter(c => c.conflict_type === 'warning').length

  return {
    conflicts,
    loading,
    blockingCount,
    warningCount,
    refresh: () => projectId && fetch(projectId),
    resolveConflict,
  }
}

// ============================================================
// Hook useProject — chargement centralisé d'un projet CTD
// ============================================================

import { useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useProjectStore } from '@/stores/projectStore'
import { useAuth } from '@/hooks/useAuth'
import type { Project } from '@/types'

export function useProject(projectId: string | undefined) {
  const { tenantId } = useAuth()
  const { currentProject, setCurrentProject, updateProject, loading, setLoading, error, setError } = useProjectStore()

  const fetch = useCallback(async (id: string) => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (err) {
      setError(err.message)
    } else {
      setCurrentProject(data as Project)
    }
    setLoading(false)
  }, [tenantId, setCurrentProject, setLoading, setError])

  useEffect(() => {
    if (projectId && projectId !== currentProject?.id) {
      fetch(projectId)
    }
  }, [projectId, fetch, currentProject?.id])

  const refresh = useCallback(() => {
    if (projectId) fetch(projectId)
  }, [projectId, fetch])

  const update = useCallback(async (updates: Partial<Project>) => {
    if (!projectId) return
    const { error: err } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
    if (!err) updateProject(projectId, updates)
    return err
  }, [projectId, updateProject])

  return {
    project: currentProject?.id === projectId ? currentProject : null,
    loading,
    error,
    refresh,
    update,
  }
}

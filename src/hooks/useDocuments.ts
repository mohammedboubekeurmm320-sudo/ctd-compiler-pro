// ============================================================
// Hook useDocuments — documents d'un projet CTD
// ============================================================

import { useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useDocumentStore } from '@/stores/documentStore'
import { useAuth } from '@/hooks/useAuth'
import type { Document } from '@/types'

export function useDocuments(projectId: string | undefined) {
  const { tenantId } = useAuth()
  const { documents, setDocuments, addDocument, updateDocument, loading, setLoading } = useDocumentStore()

  const fetch = useCallback(async (id: string) => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', id)
      .eq('tenant_id', tenantId)
      .order('uploaded_at', { ascending: false })
    setDocuments((data ?? []) as Document[])
    setLoading(false)
  }, [tenantId, setDocuments, setLoading])

  useEffect(() => {
    if (projectId) fetch(projectId)
  }, [projectId, fetch])

  // Abonnement realtime pour les mises à jour de statut
  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`documents:${projectId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents',
        filter: `project_id=eq.${projectId}`,
      }, payload => {
        updateDocument(
          payload.new.id as string,
          payload.new as Partial<Document>
        )
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId, updateDocument])

  return {
    documents,
    loading,
    refresh: () => projectId && fetch(projectId),
    addDocument,
    updateDocument,
  }
}

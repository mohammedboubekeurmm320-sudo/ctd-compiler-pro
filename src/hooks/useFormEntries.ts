// ============================================================
// Hook useFormEntries — entrées formulaire CTD d'un projet
// ============================================================

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { CTDFormEntry, EntryStatus, ReviewStatus } from '@/types'

export function useFormEntries(projectId: string | undefined) {
  const { tenantId, user } = useAuth()
  const [entries, setEntries] = useState<CTDFormEntry[]>([])
  const [loading, setLoading] = useState(false)
  const pendingUpdates = useRef<Map<string, Partial<CTDFormEntry>>>(new Map())
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = useCallback(async (id: string) => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('ctd_form_entries')
      .select('*')
      .eq('project_id', id)
      .eq('tenant_id', tenantId)
      .order('ctd_section')
    setEntries((data ?? []) as CTDFormEntry[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    if (projectId) fetch(projectId)
  }, [projectId, fetch])

  // Autosave toutes les 30 secondes
  useEffect(() => {
    autosaveTimer.current = setInterval(flushPending, 30000)
    return () => {
      if (autosaveTimer.current) clearInterval(autosaveTimer.current)
      flushPending()
    }
  }, [])

  const flushPending = useCallback(async () => {
    if (pendingUpdates.current.size === 0) return
    const batch = Array.from(pendingUpdates.current.entries())
    pendingUpdates.current.clear()
    await Promise.all(batch.map(([id, updates]) =>
      supabase.from('ctd_form_entries').update(updates).eq('id', id)
    ))
  }, [])

  const updateLocal = useCallback((id: string, updates: Partial<CTDFormEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }, [])

  const acceptEntry = useCallback(async (entryId: string) => {
    const updates: Partial<CTDFormEntry> = {
      entry_status: 'accepted' as EntryStatus,
      updated_at: new Date().toISOString(),
    }
    updateLocal(entryId, updates)
    await supabase.from('ctd_form_entries').update(updates).eq('id', entryId)
  }, [updateLocal])

  const modifyEntry = useCallback((entryId: string, newValue: string) => {
    const updates: Partial<CTDFormEntry> = {
      field_value: newValue,
      entry_status: 'modified' as EntryStatus,
      updated_at: new Date().toISOString(),
    }
    updateLocal(entryId, updates)
    pendingUpdates.current.set(entryId, updates)
  }, [updateLocal])

  const rejectEntry = useCallback(async (entryId: string, annotation: string) => {
    const updates: Partial<CTDFormEntry> = {
      entry_status: 'rejected' as EntryStatus,
      annotation,
      updated_at: new Date().toISOString(),
    }
    updateLocal(entryId, updates)
    await supabase.from('ctd_form_entries').update(updates).eq('id', entryId)
  }, [updateLocal])

  const submitSection = useCallback(async (section: string) => {
    const updates: Partial<CTDFormEntry> = {
      review_status: 'submitted' as ReviewStatus,
    }
    setEntries(prev => prev.map(e =>
      e.ctd_section === section ? { ...e, ...updates } : e
    ))
    await supabase
      .from('ctd_form_entries')
      .update(updates)
      .eq('project_id', projectId ?? '')
      .eq('ctd_section', section)
  }, [projectId])

  const approveSection = useCallback(async (section: string) => {
    if (!user) return
    const updates: Partial<CTDFormEntry> = {
      review_status: 'approved' as ReviewStatus,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    }
    setEntries(prev => prev.map(e =>
      e.ctd_section === section ? { ...e, ...updates } : e
    ))
    await supabase
      .from('ctd_form_entries')
      .update(updates)
      .eq('project_id', projectId ?? '')
      .eq('ctd_section', section)
  }, [projectId, user])

  const completionBySection = useCallback((section: string): number => {
    const sEntries = entries.filter(e => e.ctd_section === section)
    if (sEntries.length === 0) return 0
    const done = sEntries.filter(e =>
      ['accepted', 'modified'].includes(e.entry_status)
    ).length
    return Math.round((done / sEntries.length) * 100)
  }, [entries])

  const globalCompletion = useCallback((): number => {
    if (entries.length === 0) return 0
    const done = entries.filter(e =>
      ['accepted', 'modified'].includes(e.entry_status)
    ).length
    return Math.round((done / entries.length) * 100)
  }, [entries])

  return {
    entries,
    loading,
    refresh: () => projectId && fetch(projectId),
    acceptEntry,
    modifyEntry,
    rejectEntry,
    submitSection,
    approveSection,
    completionBySection,
    globalCompletion,
    flushPending,
  }
}

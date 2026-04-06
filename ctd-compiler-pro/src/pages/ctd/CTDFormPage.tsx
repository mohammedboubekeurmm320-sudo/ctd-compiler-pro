// ============================================================
// M17 + M18 — Formulaire CTD dynamique + Revue humaine
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useAuditLog } from '@/hooks/useAuditLog'
import { useNotificationStore } from '@/stores/documentStore'
import { Button, Card, Badge, Alert, Textarea, Spinner } from '@/components/ui'
import type {
  Project, CTDSection, CTDFormEntry, Conflict,
  Extraction, EntryStatus, ReviewStatus
} from '@/types'
import {
  CheckCircle2, XCircle, Edit3, MessageSquare,
  AlertTriangle, ChevronRight, ChevronDown, Send, ThumbsUp
} from 'lucide-react'
import { clsx } from 'clsx'

export function CTDFormPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user, tenantId, canEdit, canReview, canApprove } = useAuth()
  const { log } = useAuditLog(tenantId, user?.id ?? null)
  const { addToast } = useNotificationStore()

  const [project, setProject] = useState<Project | null>(null)
  const [entries, setEntries] = useState<CTDFormEntry[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingUpdates = useRef<Map<string, Partial<CTDFormEntry>>>(new Map())

  useEffect(() => {
    if (projectId) loadData()
    // Autosave toutes les 30s
    autosaveRef.current = setInterval(flushPendingUpdates, 30000)
    return () => {
      if (autosaveRef.current) clearInterval(autosaveRef.current)
      flushPendingUpdates()
    }
  }, [projectId])

  const loadData = async () => {
    setLoading(true)
    const [{ data: proj }, { data: ents }, { data: confs }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('ctd_form_entries').select('*').eq('project_id', projectId),
      supabase.from('conflicts').select('*').eq('project_id', projectId).eq('resolved', false),
    ])
    setProject(proj as Project)
    setEntries((ents ?? []) as CTDFormEntry[])
    setConflicts((confs ?? []) as Conflict[])
    if (proj?.ctd_profile?.sections?.[0]) {
      setActiveSection((proj as Project).ctd_profile!.sections[0].code)
      setExpandedSections(new Set([(proj as Project).ctd_profile!.sections[0].code]))
    }
    setLoading(false)
  }

  const flushPendingUpdates = async () => {
    for (const [entryId, updates] of pendingUpdates.current.entries()) {
      await supabase.from('ctd_form_entries').update(updates).eq('id', entryId)
    }
    pendingUpdates.current.clear()
  }

  // M18 — Accepter une suggestion
  const acceptSuggestion = async (entry: CTDFormEntry) => {
    const updates: Partial<CTDFormEntry> = {
      entry_status: 'accepted' as EntryStatus,
      updated_at: new Date().toISOString(),
    }
    updateEntryLocally(entry.id, updates)
    await supabase.from('ctd_form_entries').update(updates).eq('id', entry.id)
    await log({ action: 'update', entityType: 'ctd_entry', entityId: entry.id, projectId,
      oldValue: { entry_status: entry.entry_status }, newValue: updates })
  }

  // M18 — Modifier une valeur
  const modifyEntry = async (entry: CTDFormEntry, newValue: string) => {
    const updates: Partial<CTDFormEntry> = {
      field_value: newValue,
      entry_status: 'modified' as EntryStatus,
      updated_at: new Date().toISOString(),
    }
    updateEntryLocally(entry.id, updates)
    pendingUpdates.current.set(entry.id, updates)
    await log({ action: 'update', entityType: 'ctd_entry', entityId: entry.id, projectId,
      oldValue: { field_value: entry.field_value }, newValue: { field_value: newValue } })
  }

  // M18 — Rejeter avec motif
  const rejectEntry = async (entry: CTDFormEntry, annotation: string) => {
    if (!annotation.trim()) { addToast('warning', 'Motif de rejet requis'); return }
    const updates: Partial<CTDFormEntry> = {
      entry_status: 'rejected' as EntryStatus,
      annotation,
      updated_at: new Date().toISOString(),
    }
    updateEntryLocally(entry.id, updates)
    await supabase.from('ctd_form_entries').update(updates).eq('id', entry.id)
    await log({ action: 'reject', entityType: 'ctd_entry', entityId: entry.id, projectId,
      newValue: { annotation } })
  }

  // M18 — Soumettre une section pour révision
  const submitSection = async (sectionCode: string) => {
    const sectionEntries = entries.filter(e => e.ctd_section === sectionCode)
    const hasBlocking = conflicts.some(c => c.ctd_section === sectionCode && c.conflict_type === 'blocking')
    if (hasBlocking) { addToast('error', 'Des conflits bloquants doivent être résolus avant soumission'); return }
    const unvalidated = sectionEntries.filter(e => e.entry_status === 'pending')
    if (unvalidated.length > 0) { addToast('warning', `${unvalidated.length} champ(s) en attente de validation`); return }

    await supabase.from('ctd_form_entries')
      .update({ review_status: 'submitted' as ReviewStatus })
      .eq('project_id', projectId)
      .eq('ctd_section', sectionCode)
    setEntries(prev => prev.map(e => e.ctd_section === sectionCode ? { ...e, review_status: 'submitted' } : e))
    addToast('success', `Section ${sectionCode} soumise pour révision`)
  }

  // M18 — Approuver une section (approbateur uniquement)
  const approveSection = async (sectionCode: string) => {
    if (!canApprove) return
    await supabase.from('ctd_form_entries')
      .update({
        review_status: 'approved' as ReviewStatus,
        approved_by: user!.id,
        approved_at: new Date().toISOString(),
      })
      .eq('project_id', projectId)
      .eq('ctd_section', sectionCode)
    setEntries(prev => prev.map(e =>
      e.ctd_section === sectionCode ? { ...e, review_status: 'approved', approved_by: user!.id } : e
    ))
    await log({ action: 'approve', entityType: 'ctd_entry', projectId,
      newValue: { ctd_section: sectionCode } })
    addToast('success', `Section ${sectionCode} approuvée`)
  }

  // Résoudre un conflit en choisissant une extraction
  const resolveConflict = async (conflict: Conflict, extractionId: string, annotation?: string) => {
    const { data: ext } = await supabase
      .from('extractions').select('extracted_value').eq('id', extractionId).single()
    if (!ext) return

    await supabase.from('conflicts')
      .update({ resolved: true, resolved_by: user!.id, resolved_at: new Date().toISOString(),
        chosen_extraction_id: extractionId, annotation: annotation ?? null })
      .eq('id', conflict.id)

    await supabase.from('ctd_form_entries')
      .upsert({
        tenant_id: tenantId!, project_id: projectId!, ctd_section: conflict.ctd_section,
        field_key: conflict.field_key, field_value: (ext as { extracted_value: string }).extracted_value,
        source_extraction_id: extractionId, entry_status: 'accepted', review_status: 'draft',
      }, { onConflict: 'project_id,ctd_section,field_key' })

    setConflicts(prev => prev.filter(c => c.id !== conflict.id))
    addToast('success', 'Conflit résolu')
    loadData()
  }

  const updateEntryLocally = (id: string, updates: Partial<CTDFormEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }

  const toggleSection = (code: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
    setActiveSection(code)
  }

  if (loading) return <div className="flex justify-center p-12"><Spinner size="lg" /></div>
  if (!project?.ctd_profile) return <Alert variant="danger">Profil CTD non configuré</Alert>

  const sections = project.ctd_profile.sections
  const blockingCount = conflicts.filter(c => c.conflict_type === 'blocking').length
  const warningCount  = conflicts.filter(c => c.conflict_type === 'warning').length

  return (
    <div className="flex h-full">
      {/* Sidebar sections CTD */}
      <nav className="w-56 border-r border-gray-100 bg-white overflow-y-auto flex-shrink-0 p-3 space-y-1">
        {sections.map(section => {
          const sEntries = entries.filter(e => e.ctd_section === section.code)
          const hasBlocking = conflicts.some(c => c.ctd_section === section.code && c.conflict_type === 'blocking')
          const isApproved = sEntries.length > 0 && sEntries.every(e => e.review_status === 'approved')
          return (
            <button
              key={section.code}
              onClick={() => toggleSection(section.code)}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors',
                activeSection === section.code
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <span className="flex-1 truncate font-mono">{section.code}</span>
              {hasBlocking && <AlertTriangle size={10} className="text-danger-500 flex-shrink-0" />}
              {isApproved && <CheckCircle2 size={10} className="text-success-500 flex-shrink-0" />}
            </button>
          )
        })}
      </nav>

      {/* Contenu principal */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Alertes globales */}
        {blockingCount > 0 && (
          <Alert variant="danger" title={`${blockingCount} conflit(s) bloquant(s)`}>
            Ces conflits doivent être résolus avant de pouvoir exporter le dossier.
          </Alert>
        )}
        {warningCount > 0 && (
          <Alert variant="warning" title={`${warningCount} avertissement(s)`}>
            Des divergences mineures ont été détectées. Vérification recommandée.
          </Alert>
        )}

        {/* Sections actives */}
        {sections
          .filter(s => !activeSection || s.code === activeSection || expandedSections.has(s.code))
          .map(section => (
            <SectionPanel
              key={section.code}
              section={section}
              entries={entries.filter(e => e.ctd_section === section.code)}
              conflicts={conflicts.filter(c => c.ctd_section === section.code)}
              canEdit={canEdit}
              canReview={canReview}
              canApprove={canApprove}
              onAccept={acceptSuggestion}
              onModify={modifyEntry}
              onReject={rejectEntry}
              onSubmit={() => submitSection(section.code)}
              onApprove={() => approveSection(section.code)}
              onResolveConflict={resolveConflict}
            />
          ))}
      </div>
    </div>
  )
}

// ─── Panel d'une section CTD ───────────────────────────────
function SectionPanel({
  section, entries, conflicts, canEdit, canReview, canApprove,
  onAccept, onModify, onReject, onSubmit, onApprove, onResolveConflict,
}: {
  section: CTDSection
  entries: CTDFormEntry[]
  conflicts: Conflict[]
  canEdit: boolean
  canReview: boolean
  canApprove: boolean
  onAccept: (e: CTDFormEntry) => void
  onModify: (e: CTDFormEntry, v: string) => void
  onReject: (e: CTDFormEntry, a: string) => void
  onSubmit: () => void
  onApprove: () => void
  onResolveConflict: (c: Conflict, extractionId: string, annotation?: string) => void
}) {
  const isSubmitted = entries.every(e => ['submitted', 'reviewed', 'approved'].includes(e.review_status))
  const isApproved  = entries.length > 0 && entries.every(e => e.review_status === 'approved')
  const hasBlocking = conflicts.some(c => c.conflict_type === 'blocking')

  return (
    <Card>
      {/* En-tête section */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-gray-800">{section.code}</span>
            {section.required && <Badge variant="info">Obligatoire</Badge>}
            {isApproved && <Badge variant="success">Approuvée</Badge>}
            {hasBlocking && <Badge variant="danger">Conflit bloquant</Badge>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{section.title}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && !isSubmitted && (
            <Button size="sm" variant="outline" onClick={onSubmit} disabled={hasBlocking}>
              <Send size={12} /> Soumettre
            </Button>
          )}
          {canApprove && isSubmitted && !isApproved && (
            <Button size="sm" onClick={onApprove}>
              <ThumbsUp size={12} /> Approuver
            </Button>
          )}
        </div>
      </div>

      {/* Conflits de la section */}
      {conflicts.map(conflict => (
        <ConflictPanel
          key={conflict.id}
          conflict={conflict}
          onResolve={onResolveConflict}
          canEdit={canEdit}
        />
      ))}

      {/* Champs */}
      <div className="space-y-4">
        {section.fields.map(field => {
          const entry = entries.find(e => e.field_key === field.key)
          return (
            <FieldRow
              key={field.key}
              field={field}
              entry={entry}
              conflict={conflicts.find(c => c.field_key === field.key)}
              canEdit={canEdit && !isApproved}
              onAccept={onAccept}
              onModify={onModify}
              onReject={onReject}
            />
          )
        })}
      </div>
    </Card>
  )
}

// ─── Ligne de champ CTD ────────────────────────────────────
function FieldRow({ field, entry, conflict, canEdit, onAccept, onModify, onReject }: {
  field: { key: string; label: string; required: boolean; unit?: string }
  entry?: CTDFormEntry
  conflict?: Conflict
  canEdit: boolean
  onAccept: (e: CTDFormEntry) => void
  onModify: (e: CTDFormEntry, v: string) => void
  onReject: (e: CTDFormEntry, a: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(entry?.field_value ?? '')
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const statusIcon = !entry ? null
    : entry.entry_status === 'accepted'  ? <CheckCircle2 size={14} className="text-success-500" />
    : entry.entry_status === 'rejected'  ? <XCircle size={14} className="text-danger-500" />
    : entry.entry_status === 'modified'  ? <Edit3 size={14} className="text-warning-500" />
    : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />

  return (
    <div className={clsx(
      'border rounded-lg p-3',
      conflict?.conflict_type === 'blocking' ? 'border-danger-200 bg-danger-50' :
      conflict?.conflict_type === 'warning'  ? 'border-warning-200 bg-warning-50' :
      entry?.entry_status === 'accepted'     ? 'border-success-100 bg-success-50' :
      'border-gray-100'
    )}>
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">{statusIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs font-medium text-gray-700">{field.label}</span>
            {field.required && <span className="text-danger-400 text-xs">*</span>}
            {field.unit && <span className="text-xs text-gray-400">({field.unit})</span>}
          </div>

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                className="w-full text-sm border border-primary-300 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
                rows={2}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { onModify(entry!, editValue); setEditing(false) }}>
                  Enregistrer
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <p className={clsx(
              'text-sm',
              entry?.field_value ? 'text-gray-800' : 'text-gray-400 italic'
            )}>
              {entry?.field_value ?? 'Aucune valeur extraite'}
            </p>
          )}

          {entry?.annotation && (
            <p className="text-xs text-gray-500 mt-1 italic">Note : {entry.annotation}</p>
          )}
        </div>

        {/* Actions — M18 */}
        {canEdit && entry && !editing && entry.entry_status !== 'rejected' && (
          <div className="flex gap-1 flex-shrink-0">
            {entry.entry_status !== 'accepted' && (
              <button
                onClick={() => onAccept(entry)}
                className="p-1 text-gray-400 hover:text-success-600 rounded transition-colors"
                title="Accepter"
              >
                <CheckCircle2 size={14} />
              </button>
            )}
            <button
              onClick={() => { setEditValue(entry.field_value ?? ''); setEditing(true) }}
              className="p-1 text-gray-400 hover:text-warning-500 rounded transition-colors"
              title="Modifier"
            >
              <Edit3 size={14} />
            </button>
            <button
              onClick={() => setShowReject(r => !r)}
              className="p-1 text-gray-400 hover:text-danger-500 rounded transition-colors"
              title="Rejeter"
            >
              <XCircle size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Panel rejet */}
      {showReject && (
        <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
          <Textarea
            label="Motif de rejet (obligatoire)"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="danger"
              onClick={() => { onReject(entry!, rejectReason); setShowReject(false) }}>
              Confirmer le rejet
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowReject(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Panel de résolution de conflit ───────────────────────
function ConflictPanel({ conflict, onResolve, canEdit }: {
  conflict: Conflict
  onResolve: (c: Conflict, extractionId: string, annotation?: string) => void
  canEdit: boolean
}) {
  const [extractions, setExtractions] = useState<Extraction[]>([])
  const [annotation, setAnnotation] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('extractions')
      .select('*')
      .in('id', conflict.extraction_ids)
      .then(({ data }) => { setExtractions((data ?? []) as Extraction[]); setLoading(false) })
  }, [conflict.id])

  return (
    <div className={clsx(
      'border rounded-lg p-4 mb-4',
      conflict.conflict_type === 'blocking' ? 'border-danger-300 bg-danger-50' : 'border-warning-200 bg-warning-50'
    )}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={14} className={conflict.conflict_type === 'blocking' ? 'text-danger-500' : 'text-warning-500'} />
        <span className="text-sm font-semibold">
          Conflit {conflict.conflict_type === 'blocking' ? 'bloquant' : 'avertissement'} — {conflict.field_key}
        </span>
      </div>

      {loading ? <Spinner size="sm" /> : (
        <div className="space-y-2">
          {extractions.map(ext => (
            <div key={ext.id} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{ext.extracted_value}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">
                      Confiance : {Math.round(ext.confidence_score * 100)}%
                    </span>
                    {ext.reliability_score && (
                      <span className="text-xs text-gray-400">
                        · Fiabilité : {ext.reliability_score}/100
                      </span>
                    )}
                    {ext.source_page && (
                      <span className="text-xs text-gray-400">· Page {ext.source_page}</span>
                    )}
                  </div>
                  {ext.source_context && (
                    <p className="text-xs text-gray-500 italic mt-1 truncate">"{ext.source_context}"</p>
                  )}
                </div>
                {canEdit && (
                  <Button size="sm" onClick={() => onResolve(conflict, ext.id, annotation)}>
                    Choisir
                  </Button>
                )}
              </div>
            </div>
          ))}

          {conflict.conflict_type === 'blocking' && (
            <div className="mt-2">
              <Textarea
                label="Justification (obligatoire pour conflit bloquant)"
                value={annotation}
                onChange={e => setAnnotation(e.target.value)}
                rows={2}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

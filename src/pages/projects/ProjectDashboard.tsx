// ============================================================
// M03 — Tableau de bord projet CTD
// ============================================================

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Badge, Button, Spinner, Alert } from '@/components/ui'
import type { Project, Document, Conflict } from '@/types'
import {
  ArrowLeft, FileText, AlertTriangle, CheckCircle2,
  Clock, Upload, Play, FileOutput
} from 'lucide-react'

interface ProjectStats {
  totalDocs: number
  extractedDocs: number
  blockingConflicts: number
  warningConflicts: number
  completedSections: number
  totalSections: number
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'info' | 'danger' }> = {
  draft:     { label: 'Brouillon',   variant: 'default' },
  in_review: { label: 'En révision', variant: 'warning' },
  approved:  { label: 'Approuvé',    variant: 'success' },
  exported:  { label: 'Exporté',     variant: 'info' },
}

export function ProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>()
  const { tenantId } = useAuth()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (projectId) fetchProjectData(projectId)
  }, [projectId])

  const fetchProjectData = async (id: string) => {
    setLoading(true)
    const [
      { data: proj },
      { data: docs },
      { data: conf },
      { count: completedCount },
    ] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('documents').select('*').eq('project_id', id).order('uploaded_at', { ascending: false }),
      supabase.from('conflicts').select('*').eq('project_id', id).eq('resolved', false),
      supabase.from('ctd_form_entries').select('*', { count: 'exact', head: true })
        .eq('project_id', id).eq('review_status', 'approved'),
    ])

    setProject(proj as Project)
    const docsList = (docs ?? []) as Document[]
    const confList = (conf ?? []) as Conflict[]
    setDocuments(docsList)
    setConflicts(confList)

    const totalSections = (proj as Project)?.ctd_profile?.sections?.length ?? 0
    setStats({
      totalDocs: docsList.length,
      extractedDocs: docsList.filter(d => d.status === 'extracted').length,
      blockingConflicts: confList.filter(c => c.conflict_type === 'blocking').length,
      warningConflicts: confList.filter(c => c.conflict_type === 'warning').length,
      completedSections: completedCount ?? 0,
      totalSections,
    })
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center p-12"><Spinner size="lg" /></div>
  if (!project) return <Alert variant="danger">Projet introuvable</Alert>

  const statusInfo = STATUS_LABELS[project.status]
  const completionPct = stats && stats.totalSections > 0
    ? Math.round((stats.completedSections / stats.totalSections) * 100)
    : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {project.molecule_name} · {project.ctd_type} · {project.regulatory_authority}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/projects/${project.id}/documents`}>
            <Button variant="outline" size="sm"><Upload size={14} /> Documents</Button>
          </Link>
          <Link to={`/projects/${project.id}/ctd`}>
            <Button size="sm"><FileOutput size={14} /> Formulaire CTD</Button>
          </Link>
        </div>
      </div>

      {/* Métriques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileText size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Documents</p>
              <p className="text-xl font-bold text-gray-900">
                {stats?.extractedDocs}/{stats?.totalDocs}
              </p>
              <p className="text-xs text-gray-400">extraits</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-danger-50 rounded-lg flex items-center justify-center">
              <AlertTriangle size={18} className="text-danger-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Conflits bloquants</p>
              <p className="text-xl font-bold text-gray-900">{stats?.blockingConflicts}</p>
              <p className="text-xs text-gray-400">{stats?.warningConflicts} avertissements</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-success-50 rounded-lg flex items-center justify-center">
              <CheckCircle2 size={18} className="text-success-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Sections complètes</p>
              <p className="text-xl font-bold text-gray-900">
                {stats?.completedSections}/{stats?.totalSections}
              </p>
              <p className="text-xs text-gray-400">{completionPct}% approuvé</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
              <Clock size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Statut global</p>
              <p className="text-sm font-semibold text-gray-900">{statusInfo.label}</p>
              <p className="text-xs text-gray-400">
                {new Date(project.updated_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Barre de progression */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progression globale du dossier</span>
          <span className="text-sm font-bold text-primary-600">{completionPct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        {stats && stats.blockingConflicts > 0 && (
          <p className="text-xs text-danger-600 mt-2">
            ⚠ {stats.blockingConflicts} conflit(s) bloquant(s) à résoudre avant export
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documents récents */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Documents sources</h2>
            <Link to={`/projects/${project.id}/documents`} className="text-xs text-primary-600 hover:underline">
              Voir tout
            </Link>
          </div>
          {documents.length === 0 ? (
            <div className="text-center py-6">
              <FileText size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Aucun document chargé</p>
              <Link to={`/projects/${project.id}/documents`}>
                <Button variant="outline" size="sm" className="mt-3">
                  <Upload size={14} /> Charger des documents
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.slice(0, 5).map(doc => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{doc.file_name}</span>
                  </div>
                  <DocStatusBadge status={doc.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Conflits actifs */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Conflits non résolus</h2>
            <Link to={`/projects/${project.id}/ctd`} className="text-xs text-primary-600 hover:underline">
              Résoudre
            </Link>
          </div>
          {conflicts.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 size={24} className="mx-auto text-success-400 mb-2" />
              <p className="text-sm text-gray-400">Aucun conflit détecté</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conflicts.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 font-mono">{c.ctd_section}</p>
                    <p className="text-xs text-gray-400">{c.field_key}</p>
                  </div>
                  <ConflictBadge type={c.conflict_type} />
                </div>
              ))}
              {conflicts.length > 5 && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  +{conflicts.length - 5} autres conflits
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function DocStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'danger' | 'info' }> = {
    uploaded:  { label: 'Uploadé',  variant: 'default' },
    parsed:    { label: 'Parsé',    variant: 'info' },
    extracted: { label: 'Extrait',  variant: 'success' },
    error:     { label: 'Erreur',   variant: 'danger' },
  }
  const s = map[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={s.variant}>{s.label}</Badge>
}

function ConflictBadge({ type }: { type: string }) {
  if (type === 'blocking') return <Badge variant="danger">Bloquant</Badge>
  if (type === 'warning')  return <Badge variant="warning">Avert.</Badge>
  return <Badge variant="success">Identique</Badge>
}

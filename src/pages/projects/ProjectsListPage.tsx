// ============================================================
// Pages secondaires groupées
// ============================================================

// ─── src/pages/projects/ProjectsListPage.tsx ──────────────
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button, Card, Badge, Spinner } from '@/components/ui'
import type { Project } from '@/types'
import { Plus, FolderOpen } from 'lucide-react'

export function ProjectsListPage() {
  const { tenantId, canEdit } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('projects').select('*')
      .eq('tenant_id', tenantId ?? '')
      .order('updated_at', { ascending: false })
      .then(({ data }) => { setProjects((data ?? []) as Project[]); setLoading(false) })
  }, [tenantId])

  const statusVariant = (s: string) => ({
    draft: 'default', in_review: 'warning', approved: 'success', exported: 'info'
  } as const)[s] ?? 'default'

  const statusLabel = (s: string) => ({
    draft: 'Brouillon', in_review: 'En révision', approved: 'Approuvé', exported: 'Exporté'
  })[s] ?? s

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Projets CTD</h1>
          <p className="text-sm text-gray-500">{projects.length} projet(s)</p>
        </div>
        {canEdit && (
          <Link to="/projects/new">
            <Button><Plus size={16} /> Nouveau projet</Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Spinner /></div>
      ) : projects.length === 0 ? (
        <Card className="text-center py-16">
          <FolderOpen size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Aucun projet</p>
          <p className="text-sm text-gray-400 mt-1">Créez votre premier dossier CTD</p>
          {canEdit && (
            <Link to="/projects/new">
              <Button className="mt-4"><Plus size={16} /> Créer un projet</Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card className="hover:border-primary-200 hover:shadow-md transition-all cursor-pointer h-full">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-sm text-gray-500 truncate">{p.molecule_name}</p>
                  </div>
                  <Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default">{p.ctd_type}</Badge>
                  <Badge variant="default">{p.regulatory_authority}</Badge>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Modifié le {new Date(p.updated_at).toLocaleDateString('fr-FR')}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

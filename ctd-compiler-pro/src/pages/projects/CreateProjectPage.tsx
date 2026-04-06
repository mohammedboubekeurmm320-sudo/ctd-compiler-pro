// ============================================================
// M01 + M02 — Création de projet CTD
// Sélection type CTD + autorité compétente → profil sections
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useAuditLog } from '@/hooks/useAuditLog'
import { useProjectStore } from '@/stores/projectStore'
import { useNotificationStore } from '@/stores/documentStore'
import { getCTDProfile } from '@/lib/ctd/sections'
import {
  Button, Input, Select, Card, Alert, Badge
} from '@/components/ui'
import type { CTDType, RegulatoryAuthority, Project } from '@/types'
import { ArrowLeft, Info } from 'lucide-react'

const CTD_TYPE_OPTIONS = [
  { value: 'M2', label: 'Module 2 — Résumés CTD' },
  { value: 'M3', label: 'Module 3 — Qualité (CMC)' },
  { value: 'M4', label: 'Module 4 — Préclinique' },
  { value: 'M5', label: 'Module 5 — Clinique' },
]

const AUTHORITY_OPTIONS = [
  { value: 'EMA',  label: 'EMA — Agence Européenne du Médicament' },
  { value: 'FDA',  label: 'FDA — Food and Drug Administration (US)' },
  { value: 'ANSM', label: 'ANSM — Agence Nationale de Sécurité du Médicament (FR)' },
  { value: 'ASDP', label: 'ASDP — Algerian Saharan Drug Program' },
  { value: 'other', label: 'Autre autorité compétente' },
]

export function CreateProjectPage() {
  const { user, tenantId, canEdit } = useAuth()
  const { log } = useAuditLog(tenantId, user?.id ?? null)
  const { addProject } = useProjectStore()
  const { addToast } = useNotificationStore()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    molecule_name: '',
    ctd_type: '' as CTDType | '',
    regulatory_authority: '' as RegulatoryAuthority | '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!canEdit) return <Alert variant="danger">Accès non autorisé</Alert>

  const ctdProfile = form.ctd_type && form.regulatory_authority
    ? getCTDProfile(form.ctd_type as CTDType, form.regulatory_authority as RegulatoryAuthority)
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.ctd_type || !form.regulatory_authority) {
      setError('Veuillez sélectionner le type CTD et l\'autorité compétente')
      return
    }
    if (!tenantId || !user) return

    setLoading(true); setError('')

    const profile = getCTDProfile(form.ctd_type as CTDType, form.regulatory_authority as RegulatoryAuthority)

    const { data, error: err } = await supabase
      .from('projects')
      .insert({
        tenant_id: tenantId,
        name: form.name,
        molecule_name: form.molecule_name,
        ctd_type: form.ctd_type,
        regulatory_authority: form.regulatory_authority,
        status: 'draft',
        ctd_profile: profile,
        created_by: user.id,
      })
      .select()
      .single()

    if (err) { setError(err.message); setLoading(false); return }

    const project = data as Project
    addProject(project)
    await log({
      action: 'create',
      entityType: 'project',
      entityId: project.id,
      projectId: project.id,
      newValue: { name: form.name, ctd_type: form.ctd_type, regulatory_authority: form.regulatory_authority },
    })

    addToast('success', `Projet "${form.name}" créé avec succès`)
    navigate(`/projects/${project.id}`)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Nouveau projet CTD</h1>
          <p className="text-sm text-gray-500">Configurez votre dossier réglementaire</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Informations projet */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Informations du projet</h2>
          <div className="space-y-4">
            <Input
              label="Nom du projet"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              placeholder="ex: Dossier AMM Amoxicilline 500mg"
            />
            <Input
              label="Dénomination commune internationale (DCI)"
              value={form.molecule_name}
              onChange={e => setForm(f => ({ ...f, molecule_name: e.target.value }))}
              required
              placeholder="ex: Amoxicilline"
              hint="Nom de la substance active selon la pharmacopée"
            />
          </div>
        </Card>

        {/* Type CTD + Autorité */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Configuration réglementaire</h2>
          <div className="space-y-4">
            <Select
              label="Type de CTD"
              value={form.ctd_type}
              onChange={e => setForm(f => ({ ...f, ctd_type: e.target.value as CTDType }))}
              options={CTD_TYPE_OPTIONS}
              placeholder="Sélectionner le type de module CTD"
              required
            />
            <Select
              label="Autorité compétente"
              value={form.regulatory_authority}
              onChange={e => setForm(f => ({ ...f, regulatory_authority: e.target.value as RegulatoryAuthority }))}
              options={AUTHORITY_OPTIONS}
              placeholder="Sélectionner l'autorité de soumission"
              required
            />
          </div>
        </Card>

        {/* Aperçu du profil de sections */}
        {ctdProfile && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Info size={14} className="text-primary-600" />
              <h2 className="text-sm font-semibold text-gray-700">
                Sections activées — {ctdProfile.sections.length} sections
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {ctdProfile.sections.slice(0, 12).map(s => (
                <Badge key={s.code} variant={s.required ? 'info' : 'default'}>
                  {s.code}
                </Badge>
              ))}
              {ctdProfile.sections.length > 12 && (
                <Badge variant="default">+{ctdProfile.sections.length - 12} autres</Badge>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Bleu = obligatoire · Gris = optionnel selon {form.regulatory_authority}
            </p>
          </Card>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => navigate('/projects')} type="button">
            Annuler
          </Button>
          <Button type="submit" loading={loading} disabled={!ctdProfile}>
            Créer le projet
          </Button>
        </div>
      </form>
    </div>
  )
}

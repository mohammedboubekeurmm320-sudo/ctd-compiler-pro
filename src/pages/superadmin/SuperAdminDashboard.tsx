// ============================================================
// M00b — Super Admin Dashboard
// Accessible uniquement role = super_admin
// ============================================================

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useAuditLog } from '@/hooks/useAuditLog'
import { useNotificationStore } from '@/stores/documentStore'
import {
  Button, Input, Select, Card, Badge, Alert, Spinner
} from '@/components/ui'
import type { Tenant, Profile } from '@/types'
import { Plus, Building2, Users, Power, PowerOff, RefreshCw } from 'lucide-react'

interface TenantWithStats extends Tenant {
  userCount: number
  projectCount: number
}

export function SuperAdminDashboard() {
  const { user, tenantId } = useAuth()
  const { log } = useAuditLog(tenantId, user?.id ?? null)
  const { addToast } = useNotificationStore()

  const [tenants, setTenants] = useState<TenantWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateTenant, setShowCreateTenant] = useState(false)
  const [showCreateAdmin, setShowCreateAdmin] = useState(false)
  const [selectedTenantId, setSelectedTenantId] = useState('')

  useEffect(() => { fetchTenants() }, [])

  const fetchTenants = async () => {
    setLoading(true)
    const { data: tenantsData, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) { addToast('error', 'Erreur chargement tenants'); setLoading(false); return }

    // Stats par tenant
    const withStats = await Promise.all((tenantsData as Tenant[]).map(async t => {
      const [{ count: userCount }, { count: projectCount }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id),
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id),
      ])
      return { ...t, userCount: userCount ?? 0, projectCount: projectCount ?? 0 }
    }))
    setTenants(withStats)
    setLoading(false)
  }

  const toggleTenantStatus = async (tenant: TenantWithStats) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active'
    const { error } = await supabase
      .from('tenants')
      .update({ status: newStatus })
      .eq('id', tenant.id)

    if (error) { addToast('error', 'Erreur mise à jour'); return }

    await log({
      action: 'update',
      entityType: 'tenant',
      entityId: tenant.id,
      oldValue: { status: tenant.status },
      newValue: { status: newStatus },
    })
    addToast('success', `Société ${newStatus === 'active' ? 'activée' : 'suspendue'}`)
    fetchTenants()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Super Admin</h1>
          <p className="text-sm text-gray-500">Gestion globale de la plateforme</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={fetchTenants}>
            <RefreshCw size={14} /> Actualiser
          </Button>
          <Button size="sm" onClick={() => setShowCreateAdmin(true)}>
            <Users size={14} /> Créer Admin Société
          </Button>
          <Button size="sm" onClick={() => setShowCreateTenant(true)}>
            <Plus size={14} /> Nouvelle société
          </Button>
        </div>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Sociétés actives</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {tenants.filter(t => t.status === 'active').length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Utilisateurs total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {tenants.reduce((acc, t) => acc + t.userCount, 0)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Projets CTD total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {tenants.reduce((acc, t) => acc + t.projectCount, 0)}
          </p>
        </Card>
      </div>

      {/* Liste des tenants */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Sociétés clientes</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Building2 size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aucune société enregistrée</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Société', 'Slug', 'Statut', 'Utilisateurs', 'Projets', 'Créée le', 'Actions'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map(tenant => (
                <tr key={tenant.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{tenant.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-500 font-mono">{tenant.slug}</td>
                  <td className="px-6 py-3">
                    <Badge variant={tenant.status === 'active' ? 'success' : 'danger'}>
                      {tenant.status === 'active' ? 'Actif' : 'Suspendu'}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{tenant.userCount}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{tenant.projectCount}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {new Date(tenant.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-3">
                    <Button
                      variant={tenant.status === 'active' ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => toggleTenantStatus(tenant)}
                    >
                      {tenant.status === 'active'
                        ? <><PowerOff size={12} /> Suspendre</>
                        : <><Power size={12} /> Réactiver</>
                      }
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Modal créer société */}
      {showCreateTenant && (
        <CreateTenantModal
          onClose={() => setShowCreateTenant(false)}
          onCreated={() => { setShowCreateTenant(false); fetchTenants() }}
        />
      )}

      {/* Modal créer admin */}
      {showCreateAdmin && (
        <CreateAdminModal
          tenants={tenants}
          onClose={() => setShowCreateAdmin(false)}
          onCreated={() => { setShowCreateAdmin(false); addToast('success', 'Compte admin créé') }}
        />
      )}
    </div>
  )
}

// ─── Modal créer tenant ────────────────────────────────────
function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { addToast } = useNotificationStore()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleNameChange = (v: string) => {
    setName(v)
    setSlug(v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.from('tenants').insert({ name, slug })
    if (err) { setError(err.message); setLoading(false); return }
    addToast('success', `Société "${name}" créée`)
    onCreated()
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h3 className="text-base font-semibold text-gray-900 mb-4">Nouvelle société</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Input label="Nom de la société" value={name} onChange={e => handleNameChange(e.target.value)} required />
        <Input label="Slug (identifiant unique)" value={slug} onChange={e => setSlug(e.target.value)} required hint="Lettres minuscules, chiffres et tirets uniquement" />
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} type="button">Annuler</Button>
          <Button type="submit" loading={loading}>Créer</Button>
        </div>
      </form>
    </ModalOverlay>
  )
}

// ─── Modal créer admin société ─────────────────────────────
function CreateAdminModal({
  tenants, onClose, onCreated
}: { tenants: TenantWithStats[]; onClose: () => void; onCreated: () => void }) {
  const { addToast } = useNotificationStore()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    // Créer l'utilisateur via Supabase Auth (service role requis côté Edge Function)
    const { data, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName, role: 'admin' },
      email_confirm: true,
    })

    if (authErr || !data.user) {
      setError(authErr?.message ?? 'Erreur création compte')
      setLoading(false)
      return
    }

    // Mettre à jour le profil avec tenant_id et rôle admin
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ tenant_id: tenantId, role: 'admin', full_name: fullName })
      .eq('id', data.user.id)

    if (profileErr) { setError(profileErr.message); setLoading(false); return }

    addToast('success', `Admin créé pour ${tenants.find(t => t.id === tenantId)?.name}`)
    onCreated()
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h3 className="text-base font-semibold text-gray-900 mb-4">Créer un Admin Société</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Select
          label="Société"
          value={tenantId}
          onChange={e => setTenantId(e.target.value)}
          options={tenants.map(t => ({ value: t.id, label: t.name }))}
          placeholder="Sélectionner une société"
          required
        />
        <Input label="Nom complet" value={fullName} onChange={e => setFullName(e.target.value)} required />
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input
          label="Mot de passe temporaire"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          hint="L'utilisateur devra le changer à la première connexion"
        />
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} type="button">Annuler</Button>
          <Button type="submit" loading={loading}>Créer le compte</Button>
        </div>
      </form>
    </ModalOverlay>
  )
}

// ─── Modal overlay générique ───────────────────────────────
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        {children}
      </div>
    </div>
  )
}

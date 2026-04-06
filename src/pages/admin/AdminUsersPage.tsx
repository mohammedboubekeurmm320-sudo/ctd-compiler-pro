// ============================================================
// Admin — Gestion des utilisateurs de la société
// ============================================================

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button, Card, Badge, Select, Alert, Input, Spinner } from '@/components/ui'
import type { Profile, UserRole } from '@/types'
import { UserPlus, RefreshCw } from 'lucide-react'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'redactor',  label: 'Rédacteur' },
  { value: 'reviewer',  label: 'Réviseur' },
  { value: 'approver',  label: 'Approbateur' },
  { value: 'admin',     label: 'Admin Société' },
]

export function AdminUsersPage() {
  const { user, tenantId } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { fetchUsers() }, [tenantId])

  const fetchUsers = async () => {
    if (!tenantId) return
    const { data } = await supabase.from('profiles').select('*')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setProfiles((data ?? []) as Profile[])
    setLoading(false)
  }

  const updateRole = async (userId: string, role: UserRole) => {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role } : p))
  }

  const toggleStatus = async (profile: Profile) => {
    const newStatus = profile.status === 'active' ? 'suspended' : 'active'
    await supabase.from('profiles').update({ status: newStatus }).eq('id', profile.id)
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, status: newStatus } : p))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Utilisateurs</h1>
          <p className="text-sm text-gray-500">{profiles.length} membre(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsers}><RefreshCw size={14} /></Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><UserPlus size={14} /> Inviter</Button>
        </div>
      </div>

      <Card padding={false}>
        {loading ? <div className="flex justify-center p-8"><Spinner /></div> : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Nom', 'Rôle', 'Statut', 'Depuis', 'Actions'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-gray-900">{p.full_name || '—'}</p>
                    <p className="text-xs text-gray-400">{p.id === user?.id ? '(vous)' : ''}</p>
                  </td>
                  <td className="px-6 py-3">
                    <Select
                      value={p.role}
                      onChange={e => updateRole(p.id, e.target.value as UserRole)}
                      options={ROLE_OPTIONS}
                      className="text-xs py-1 w-36"
                      disabled={p.id === user?.id}
                    />
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={p.status === 'active' ? 'success' : 'danger'}>
                      {p.status === 'active' ? 'Actif' : 'Suspendu'}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {new Date(p.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-3">
                    {p.id !== user?.id && (
                      <Button
                        size="sm"
                        variant={p.status === 'active' ? 'danger' : 'secondary'}
                        onClick={() => toggleStatus(p)}
                      >
                        {p.status === 'active' ? 'Suspendre' : 'Réactiver'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showCreate && (
        <CreateUserModal tenantId={tenantId!} onClose={() => setShowCreate(false)} onCreated={fetchUsers} />
      )}
    </div>
  )
}

function CreateUserModal({ tenantId, onClose, onCreated }: {
  tenantId: string; onClose: () => void; onCreated: () => void
}) {
  const [form, setForm] = useState({ email: '', fullName: '', role: 'redactor' as UserRole, password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const { data, error: authErr } = await supabase.auth.admin.createUser({
      email: form.email, password: form.password,
      user_metadata: { full_name: form.fullName, role: form.role },
      email_confirm: true,
    })
    if (authErr || !data.user) { setError(authErr?.message ?? 'Erreur'); setLoading(false); return }
    await supabase.from('profiles').update({
      tenant_id: tenantId, role: form.role, full_name: form.fullName
    }).eq('id', data.user.id)
    onCreated(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-base font-semibold mb-4">Inviter un utilisateur</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <Input label="Nom complet" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <Input label="Mot de passe temporaire" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <Select label="Rôle" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))} options={ROLE_OPTIONS} required />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={onClose} type="button">Annuler</Button>
            <Button type="submit" loading={loading}>Créer</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// M20 — Audit Trail Page
// ============================================================

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Badge, Spinner } from '@/components/ui'
import type { AuditLog } from '@/types'
import { ClipboardList } from 'lucide-react'

export function AuditTrailPage() {
  const { tenantId } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('audit_log').select(`*, profiles!user_id(full_name)`)
      .eq('tenant_id', tenantId ?? '')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => { setLogs((data ?? []) as AuditLog[]); setLoading(false) })
  }, [tenantId])

  const actionVariant = (a: string) => {
    if (['approve', 'create'].includes(a)) return 'success'
    if (['reject', 'delete'].includes(a)) return 'danger'
    if (['submit', 'review'].includes(a)) return 'warning'
    return 'default'
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Audit Trail</h1>
        <p className="text-sm text-gray-500">Historique complet des actions — conforme 21 CFR Part 11</p>
      </div>
      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center p-8"><Spinner /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucune action enregistrée</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date', 'Utilisateur', 'Action', 'Entité', 'Détails'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {(log as AuditLog & { profiles?: { full_name: string } }).profiles?.full_name ?? '—'}
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={actionVariant(log.action)}>{log.action}</Badge>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{log.entity_type}</td>
                  <td className="px-6 py-3 text-xs text-gray-400 max-w-xs truncate">
                    {log.new_value ? JSON.stringify(log.new_value).substring(0, 80) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

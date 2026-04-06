// ============================================================
// Page Settings — configuration du tenant
// Accessible : admin · super_admin
// ============================================================

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useNotificationStore } from '@/stores/documentStore'
import { getLLMProvider } from '@/lib/llm'
import {
  Button, Input, Card, Alert, Badge, Spinner
} from '@/components/ui'
import { Settings, Key, HardDrive, Globe, CheckCircle2, XCircle } from 'lucide-react'
import type { TenantSettings } from '@/types'

export function SettingsPage() {
  const { user, tenantId, isAdmin, isSuperAdmin } = useAuth()
  const { addToast } = useNotificationStore()

  const [settings, setSettings] = useState<Partial<TenantSettings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [llmStatus, setLlmStatus] = useState<'checking' | 'ok' | 'error' | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [tenantId])

  const fetchSettings = async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()
    if (data) setSettings(data as TenantSettings)
    setLoading(false)
  }

  const saveSettings = async () => {
    if (!tenantId) return
    setSaving(true)
    const payload = {
      tenant_id: tenantId,
      nas_path: settings.nas_path ?? null,
      dms_url: settings.dms_url ?? null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase
      .from('tenant_settings')
      .upsert(payload, { onConflict: 'tenant_id' })

    if (error) {
      addToast('error', `Erreur sauvegarde : ${error.message}`)
    } else {
      addToast('success', 'Paramètres enregistrés')
    }
    setSaving(false)
  }

  const testLLM = async () => {
    setLlmStatus('checking')
    try {
      const provider = getLLMProvider()
      const ok = await provider.healthCheck()
      setLlmStatus(ok ? 'ok' : 'error')
    } catch {
      setLlmStatus('error')
    }
  }

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="p-6">
        <Alert variant="danger">Accès réservé aux administrateurs.</Alert>
      </div>
    )
  }

  if (loading) {
    return <div className="flex justify-center p-12"><Spinner /></div>
  }

  const currentProvider = import.meta.env.VITE_LLM_PROVIDER ?? 'gemini'

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings size={20} className="text-gray-400" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Paramètres</h1>
          <p className="text-sm text-gray-500">Configuration de votre espace de travail</p>
        </div>
      </div>

      {/* LLM Provider */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Key size={16} className="text-primary-600" />
          <h2 className="text-sm font-semibold text-gray-800">Moteur d'extraction LLM</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-800 capitalize">
                {currentProvider === 'gemini' ? 'Google Gemini 1.5 Flash' : `Ollama (${import.meta.env.VITE_OLLAMA_MODEL ?? 'llama3.3'})`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {currentProvider === 'gemini'
                  ? 'API cloud · Free tier · PDF natif'
                  : 'Modèle local · Données restent on-premise'}
              </p>
            </div>
            <Badge variant={currentProvider === 'gemini' ? 'info' : 'success'}>
              {currentProvider === 'gemini' ? 'Cloud' : 'On-premise'}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={testLLM} loading={llmStatus === 'checking'}>
              Tester la connexion
            </Button>
            {llmStatus === 'ok' && (
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 size={14} /> Connecté
              </div>
            )}
            {llmStatus === 'error' && (
              <div className="flex items-center gap-1.5 text-sm text-red-600">
                <XCircle size={14} /> Erreur de connexion
              </div>
            )}
          </div>

          <Alert variant="info">
            Pour changer de provider (Gemini ↔ Ollama), modifiez la variable
            <code className="mx-1 px-1 bg-blue-100 rounded text-xs">LLM_PROVIDER</code>
            dans votre fichier .env et redéployez. Aucun changement de code requis.
          </Alert>
        </div>
      </Card>

      {/* Connecteur NAS */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <HardDrive size={16} className="text-primary-600" />
          <h2 className="text-sm font-semibold text-gray-800">Connecteur réseau / NAS</h2>
          <Badge variant="default">Optionnel</Badge>
        </div>

        <div className="space-y-3">
          <Input
            label="Chemin réseau (UNC ou chemin local)"
            value={settings.nas_path ?? ''}
            onChange={e => setSettings(s => ({ ...s, nas_path: e.target.value }))}
            placeholder="\\\\serveur\\partage\\documents ou /mnt/nas/documents"
            hint="Laissez vide si vous n'utilisez pas de NAS"
          />
          <p className="text-xs text-gray-400">
            Le programme scannera ce dossier lors de l'import de documents via le connecteur réseau (M05).
          </p>
        </div>
      </Card>

      {/* Connecteur DMS */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-primary-600" />
          <h2 className="text-sm font-semibold text-gray-800">Connecteur DMS</h2>
          <Badge variant="default">Optionnel</Badge>
        </div>

        <div className="space-y-3">
          <Input
            label="URL de l'API DMS"
            value={settings.dms_url ?? ''}
            onChange={e => setSettings(s => ({ ...s, dms_url: e.target.value }))}
            placeholder="https://votre-sharepoint.com/api ou https://api.veeva.com"
            hint="SharePoint, Veeva Vault ou tout DMS compatible REST"
          />
          <Alert variant="warning">
            La clé API DMS est stockée de façon chiffrée côté serveur.
            Ne la saisissez jamais dans le frontend — configurez-la directement
            dans les variables d'environnement Supabase Edge Functions.
          </Alert>
        </div>
      </Card>

      {/* Informations tenant */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Informations du compte</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tenant ID</span>
            <code className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded font-mono">
              {tenantId?.substring(0, 16)}...
            </code>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Utilisateur</span>
            <span className="text-gray-800">{user?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Environnement</span>
            <Badge variant="info">
              {import.meta.env.DEV ? 'Développement' : 'Production'}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveSettings} loading={saving}>
          Enregistrer les paramètres
        </Button>
      </div>
    </div>
  )
}

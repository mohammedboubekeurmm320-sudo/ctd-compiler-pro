// ============================================================
// M21 + M22 — Page Export CTD
// Contrôle qualité + génération + téléchargement
// ============================================================

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useNotificationStore } from '@/stores/documentStore'
import { Button, Card, Badge, Alert, Spinner } from '@/components/ui'
import type { QCCheck } from '@/types'
import { CheckCircle2, XCircle, FileOutput, Download, Shield } from 'lucide-react'

interface ExportResult {
  success: boolean
  qcReport: {
    generated_at: string
    passed: boolean
    checks: QCCheck[]
  }
  signedUrls?: Record<string, string>
  entriesExported?: number
  authority?: string
  error?: string
}

export function ExportCTDPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { canExport } = useAuth()
  const { addToast } = useNotificationStore()

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)

  if (!canExport) {
    return (
      <div className="p-6">
        <Alert variant="danger" title="Accès refusé">
          Seuls les approbateurs et administrateurs peuvent exporter le dossier CTD.
        </Alert>
      </div>
    )
  }

  const handleExport = async () => {
    setLoading(true)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expirée')

      const response = await supabase.functions.invoke('export-ctd', {
        body: { projectId },
      })

      const data = response.data as ExportResult

      setResult(data)

      if (data.success) {
        addToast('success', `Dossier CTD exporté — ${data.entriesExported} champs`)
      } else {
        addToast('error', data.error ?? 'Contrôle qualité échoué')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur export'
      addToast('error', message)
      setResult({ success: false, qcReport: { generated_at: '', passed: false, checks: [] }, error: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
          <FileOutput size={20} className="text-primary-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Export du dossier CTD</h1>
          <p className="text-sm text-gray-500">
            Le contrôle qualité ICH M4 sera exécuté avant la génération
          </p>
        </div>
      </div>

      {/* Info pré-export */}
      {!result && (
        <Card>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Shield size={16} className="text-primary-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">Contrôle qualité automatique</p>
                <p className="text-sm text-gray-500">
                  Avant l'export, le programme vérifie : absence de conflits bloquants,
                  complétude des sections obligatoires, et validation humaine de tous les champs.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileOutput size={16} className="text-primary-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">Formats générés</p>
                <p className="text-sm text-gray-500">
                  PDF CTD structuré (toutes autorités) · XML backbone eCTD (EMA / FDA)
                  · JSON d'archivage
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <Button
              onClick={handleExport}
              loading={loading}
              size="lg"
              className="w-full"
            >
              <FileOutput size={18} />
              {loading ? 'Génération en cours...' : 'Lancer le contrôle qualité et exporter'}
            </Button>
          </div>
        </Card>
      )}

      {/* Spinner pendant l'export */}
      {loading && (
        <Card className="text-center py-8">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500 mt-4">
            Contrôle qualité en cours puis génération du dossier...
          </p>
        </Card>
      )}

      {/* Résultat QC */}
      {result && !loading && (
        <>
          <Card>
            <div className="flex items-center gap-3 mb-4">
              {result.qcReport.passed
                ? <CheckCircle2 size={20} className="text-success-500" />
                : <XCircle size={20} className="text-danger-500" />
              }
              <div>
                <p className="font-semibold text-gray-900">
                  Contrôle qualité {result.qcReport.passed ? 'réussi' : 'échoué'}
                </p>
                {result.qcReport.generated_at && (
                  <p className="text-xs text-gray-400">
                    {new Date(result.qcReport.generated_at).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {result.qcReport.checks.map((check, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  {check.passed
                    ? <CheckCircle2 size={16} className="text-success-500 flex-shrink-0 mt-0.5" />
                    : <XCircle size={16} className="text-danger-500 flex-shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className="text-sm font-medium text-gray-800">{check.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{check.details}</p>
                  </div>
                  <Badge
                    variant={check.passed ? 'success' : 'danger'}
                    className="ml-auto flex-shrink-0"
                  >
                    {check.passed ? 'OK' : 'Échec'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Téléchargements */}
          {result.success && result.signedUrls && (
            <Card>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Fichiers générés — {result.entriesExported} champs exportés
              </h2>
              <div className="space-y-3">
                {result.signedUrls.json && (
                  <a
                    href={result.signedUrls.json}
                    download={`CTD_${result.authority}_export.json`}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Download size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">CTD JSON structuré</p>
                      <p className="text-xs text-gray-400">Archivage · intégration CTMS / EDC</p>
                    </div>
                    <Badge variant="info">JSON</Badge>
                  </a>
                )}

                {result.signedUrls.xml && (
                  <a
                    href={result.signedUrls.xml}
                    download={`eCTD_backbone_${result.authority}.xml`}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                      <Download size={16} className="text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        eCTD XML Backbone — {result.authority}
                      </p>
                      <p className="text-xs text-gray-400">
                        {result.authority === 'FDA' ? 'eCTD v3.2.2' : 'EMA eCTD format'}
                      </p>
                    </div>
                    <Badge variant="purple">XML</Badge>
                  </a>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Les liens de téléchargement sont valides pendant 1 heure.
                  L'export a été enregistré dans l'audit trail.
                </p>
              </div>
            </Card>
          )}

          {/* Relancer si échec */}
          {!result.success && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setResult(null) }}
            >
              Corriger les problèmes et réessayer
            </Button>
          )}
        </>
      )}
    </div>
  )
}

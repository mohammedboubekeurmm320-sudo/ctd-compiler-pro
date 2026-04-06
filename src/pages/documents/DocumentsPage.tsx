// ============================================================
// M04 + M07 + M08 — Upload · Qualification · Registre docs
// ============================================================

import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useAuditLog } from '@/hooks/useAuditLog'
import { useDocumentStore } from '@/stores/documentStore'
import { useNotificationStore } from '@/stores/documentStore'
import { getLLMProvider } from '@/lib/llm'
import {
  Button, Card, Badge, Alert, Select, Spinner
} from '@/components/ui'
import type { Document, DocCategory, FileType } from '@/types'
import {
  Upload, FileText, RefreshCw, Trash2, Play,
  CheckCircle2, AlertCircle, Clock
} from 'lucide-react'
import { clsx } from 'clsx'

const CATEGORY_OPTIONS: { value: DocCategory; label: string }[] = [
  { value: 'dmf',         label: 'DMF — Drug Master File' },
  { value: 'stability',   label: 'Étude de stabilité' },
  { value: 'coa',         label: 'Certificat d\'analyse (CoA)' },
  { value: 'protocol',    label: 'Protocole analytique' },
  { value: 'preclinical', label: 'Étude préclinique / toxicologie' },
  { value: 'csr',         label: 'Rapport d\'étude clinique (CSR)' },
  { value: 'other',       label: 'Autre document' },
]

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function getFileType(file: File): FileType | null {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const map: Record<string, FileType> = {
    pdf: 'pdf', docx: 'docx', xlsx: 'xlsx', csv: 'csv', txt: 'txt'
  }
  return map[ext ?? ''] ?? null
}

export function DocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user, tenantId } = useAuth()
  const { log } = useAuditLog(tenantId, user?.id ?? null)
  const { documents, setDocuments, addDocument, updateDocument } = useDocumentStore()
  const { addToast } = useNotificationStore()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  useEffect(() => {
    if (projectId) fetchDocuments()
  }, [projectId])

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false })
    setDocuments((data ?? []) as Document[])
  }

  // M04 — Upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!tenantId || !user || !projectId) return
    setUploading(true)

    for (const file of acceptedFiles) {
      const fileType = getFileType(file)
      if (!fileType) { addToast('warning', `Format non supporté : ${file.name}`); continue }
      if (file.size > 50 * 1024 * 1024) { addToast('warning', `Fichier trop volumineux : ${file.name}`); continue }

      const hash = await computeSHA256(file)

      // Anti-doublon
      const { data: existing } = await supabase
        .from('documents')
        .select('id, file_name')
        .eq('project_id', projectId)
        .eq('file_hash', hash)
        .single()

      if (existing) {
        addToast('warning', `Document déjà présent : ${file.name}`)
        continue
      }

      const filePath = `${tenantId}/${projectId}/${Date.now()}_${file.name}`

      // Upload vers Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadErr) { addToast('error', `Erreur upload : ${file.name}`); continue }

      // Insertion en base
      const { data: doc, error: dbErr } = await supabase
        .from('documents')
        .insert({
          tenant_id: tenantId,
          project_id: projectId,
          file_name: file.name,
          file_path: filePath,
          file_type: fileType,
          file_size_bytes: file.size,
          file_hash: hash,
          doc_category: 'other',
          doc_category_confirmed: false,
          status: 'uploaded',
          uploaded_by: user.id,
        })
        .select()
        .single()

      if (dbErr || !doc) continue

      addDocument(doc as Document)
      await log({ action: 'create', entityType: 'document', entityId: doc.id, projectId })

      // M07 — Qualification automatique
      qualifyDocument(doc as Document, file)
    }

    setUploading(false)
  }, [tenantId, user, projectId])

  // M07 — Qualification automatique du document
  const qualifyDocument = async (doc: Document, file: File) => {
    try {
      const text = await extractTextSample(file)
      const provider = getLLMProvider()
      const result = await provider.qualifyDocument(doc.file_name, text)

      await supabase
        .from('documents')
        .update({
          doc_category: result.category,
          category_confidence: result.confidence,
        })
        .eq('id', doc.id)

      updateDocument(doc.id, {
        doc_category: result.category,
        category_confidence: result.confidence,
      })
    } catch {
      // Qualification échouée — l'utilisateur corrige manuellement
    }
  }

  const confirmCategory = async (docId: string, category: DocCategory) => {
    await supabase
      .from('documents')
      .update({ doc_category: category, doc_category_confirmed: true })
      .eq('id', docId)
    updateDocument(docId, { doc_category: category, doc_category_confirmed: true })
    addToast('success', 'Catégorie confirmée')
  }

  const launchExtraction = async (docId: string) => {
    updateDocument(docId, { status: 'parsed' })
    // L'extraction réelle est déclenchée via Edge Function (M09/M11)
    const { error } = await supabase.functions.invoke('extract-document', {
      body: { documentId: docId, projectId },
    })
    if (error) {
      updateDocument(docId, { status: 'error', error_message: error.message })
      addToast('error', 'Erreur lors de l\'extraction')
    } else {
      addToast('info', 'Extraction lancée — résultats disponibles dans quelques instants')
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
    maxFiles: 20,
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Documents sources</h1>
        <p className="text-sm text-gray-500">Chargez vos documents et confirmez leur catégorie avant extraction</p>
      </div>

      {/* Zone upload — M04 */}
      <Card>
        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
          )}
        >
          <input {...getInputProps()} />
          <Upload size={32} className={clsx('mx-auto mb-3', isDragActive ? 'text-primary-500' : 'text-gray-300')} />
          {uploading ? (
            <div className="space-y-2">
              <Spinner size="sm" />
              <p className="text-sm text-gray-500">Upload en cours...</p>
            </div>
          ) : isDragActive ? (
            <p className="text-sm text-primary-600 font-medium">Déposez les fichiers ici</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                Glissez vos documents ici ou <span className="text-primary-600">parcourir</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PDF · DOCX · XLSX · CSV · TXT — 50 MB max par fichier
              </p>
            </>
          )}
        </div>
      </Card>

      {/* M08 — Registre des documents */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Registre des documents ({documents.length})
          </h2>
          <Button variant="ghost" size="sm" onClick={fetchDocuments}>
            <RefreshCw size={14} />
          </Button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucun document chargé</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {documents.map(doc => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onConfirmCategory={confirmCategory}
                onLaunchExtraction={launchExtraction}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Ligne document avec qualification ────────────────────
function DocumentRow({
  doc,
  onConfirmCategory,
  onLaunchExtraction,
}: {
  doc: Document
  onConfirmCategory: (id: string, cat: DocCategory) => void
  onLaunchExtraction: (id: string) => void
}) {
  const [category, setCategory] = useState<DocCategory>(doc.doc_category)

  const statusIcon = {
    uploaded:  <Clock size={14} className="text-gray-400" />,
    parsed:    <Spinner size="sm" />,
    extracted: <CheckCircle2 size={14} className="text-success-500" />,
    error:     <AlertCircle size={14} className="text-danger-500" />,
  }[doc.status]

  return (
    <div className="px-6 py-4">
      <div className="flex items-start gap-3">
        <FileText size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800 truncate">{doc.file_name}</span>
            {statusIcon}
            {doc.status === 'error' && (
              <span className="text-xs text-danger-500">{doc.error_message}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {/* M07 — Qualification */}
            {!doc.doc_category_confirmed ? (
              <div className="flex items-center gap-2">
                <Select
                  value={category}
                  onChange={e => setCategory(e.target.value as DocCategory)}
                  options={CATEGORY_OPTIONS}
                  className="text-xs py-1"
                />
                {doc.category_confidence && (
                  <span className="text-xs text-gray-400">
                    Confiance : {Math.round(doc.category_confidence * 100)}%
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onConfirmCategory(doc.id, category)}
                >
                  Confirmer
                </Button>
              </div>
            ) : (
              <Badge variant="success">{
                CATEGORY_OPTIONS.find(o => o.value === doc.doc_category)?.label ?? doc.doc_category
              }</Badge>
            )}

            {/* Lancer extraction */}
            {doc.doc_category_confirmed && doc.status === 'uploaded' && (
              <Button size="sm" onClick={() => onLaunchExtraction(doc.id)}>
                <Play size={12} /> Extraire
              </Button>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-400 flex-shrink-0">
          {doc.file_size_bytes ? `${(doc.file_size_bytes / 1024).toFixed(0)} KB` : ''}
        </div>
      </div>
    </div>
  )
}

// Extrait un échantillon de texte pour la qualification (lecture partielle)
async function extractTextSample(file: File): Promise<string> {
  if (file.type === 'text/plain' || file.type === 'text/csv') {
    return file.text().then(t => t.substring(0, 2000))
  }
  // Pour PDF/DOCX, on retourne juste le nom — la qualification se base dessus
  return `Fichier : ${file.name}\nType : ${file.type}`
}

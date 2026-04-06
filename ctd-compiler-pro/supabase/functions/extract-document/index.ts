// ============================================================
// Edge Function : extract-document
// M09 Parsing · M11 Extraction LLM · M10 NER · M13 Mapping
// Runtime : Deno (Supabase Edge Functions)
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const GEMINI_MODEL = 'gemini-1.5-flash'
const CHUNK_SIZE = 3500
const CHUNK_OVERLAP = 200

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auth : récupérer l'utilisateur depuis le JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Non authentifié')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) throw new Error('Token invalide')

    // Récupérer le profil pour vérifier tenant_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) throw new Error('Tenant non trouvé')

    const { documentId, projectId } = await req.json() as {
      documentId: string
      projectId: string
    }

    // Vérifier que le document appartient au tenant
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('tenant_id', profile.tenant_id)
      .single()

    if (docErr || !doc) throw new Error('Document introuvable ou accès refusé')

    // Récupérer le projet pour ctd_type
    const { data: project } = await supabase
      .from('projects')
      .select('ctd_type, ctd_profile')
      .eq('id', projectId)
      .single()

    if (!project) throw new Error('Projet introuvable')

    // M09 — Télécharger et parser le document depuis Storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('documents')
      .download(doc.file_path)

    if (downloadErr || !fileData) throw new Error('Impossible de télécharger le document')

    // Mise à jour statut
    await supabase.from('documents').update({ status: 'parsed' }).eq('id', documentId)

    // Extraction du texte selon le type de fichier
    const text = await extractText(fileData, doc.file_type)
    const chunks = splitIntoChunks(text, CHUNK_SIZE, CHUNK_OVERLAP)

    console.log(`[extract-document] ${chunks.length} chunks pour ${doc.file_name}`)

    // M11 — Extraction LLM chunk par chunk
    const allExtractions: ExtractionItem[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      try {
        const items = await extractWithGemini(chunk, project.ctd_type, doc.doc_category)
        allExtractions.push(...items)
      } catch (err) {
        console.error(`[extract-document] Erreur chunk ${i}:`, err)
      }
      // Pause entre les appels pour respecter les rate limits
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // M13 — Mapping : filtrer selon le profil CTD du projet
    const activeSectionCodes: string[] = project.ctd_profile?.sections?.map(
      (s: { code: string }) => s.code
    ) ?? []

    const validExtractions = activeSectionCodes.length > 0
      ? allExtractions.filter(e =>
          activeSectionCodes.some(code => e.ctd_section.startsWith(code.replace(/\./g, '\\.')))
        )
      : allExtractions

    // Insérer les extractions en base
    if (validExtractions.length > 0) {
      const rows = validExtractions.map(e => ({
        tenant_id: profile.tenant_id,
        document_id: documentId,
        project_id: projectId,
        ctd_section: e.ctd_section,
        field_key: e.field_key,
        extracted_value: e.extracted_value,
        confidence_score: e.confidence,
        source_context: e.source_context,
        llm_model: GEMINI_MODEL,
      }))

      const { error: insertErr } = await supabase.from('extractions').insert(rows)
      if (insertErr) console.error('[extract-document] Erreur insertion extractions:', insertErr)
    }

    // Mise à jour statut final
    await supabase
      .from('documents')
      .update({ status: 'extracted' })
      .eq('id', documentId)

    // Déclencher la détection de conflits
    await supabase.functions.invoke('detect-conflicts', {
      body: { projectId, tenantId: profile.tenant_id },
    })

    return new Response(
      JSON.stringify({
        success: true,
        extractionsCount: validExtractions.length,
        chunksProcessed: chunks.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ─── Types locaux ──────────────────────────────────────────
interface ExtractionItem {
  ctd_section: string
  field_key: string
  extracted_value: string
  confidence: number
  source_context: string
}

// ─── Extraction texte ─────────────────────────────────────
async function extractText(blob: Blob, fileType: string): Promise<string> {
  if (fileType === 'txt' || fileType === 'csv') {
    return blob.text()
  }
  // Pour PDF/DOCX : utiliser le contenu brut en texte (Deno ne dispose pas de librairies PDF)
  // En production, utiliser un service de parsing ou pré-parser côté client
  const buffer = await blob.arrayBuffer()
  const decoder = new TextDecoder('utf-8', { fatal: false })
  return decoder.decode(buffer).replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim()
}

// ─── Découpage en chunks ───────────────────────────────────
function splitIntoChunks(text: string, size: number, overlap: number): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  let start = 0

  while (start < words.length) {
    const end = Math.min(start + size, words.length)
    chunks.push(words.slice(start, end).join(' '))
    start += size - overlap
    if (start >= words.length) break
  }

  return chunks.filter(c => c.trim().length > 50)
}

// ─── Appel Gemini ──────────────────────────────────────────
async function extractWithGemini(
  content: string,
  ctdType: string,
  docCategory: string
): Promise<ExtractionItem[]> {
  const prompt = `Tu es un expert en dossiers réglementaires pharmaceutiques CTD ICH M4.
Type de CTD : ${ctdType} | Catégorie document : ${docCategory}
Analyse ce fragment et extrais les informations CTD.
Retourne UNIQUEMENT ce JSON valide, sans texte avant ou après :
{"extractions":[{"ctd_section":"3.2.S.1.1","field_key":"manufacturer_name","extracted_value":"valeur","confidence":0.95,"source_context":"contexte"}]}
Si rien de pertinent : {"extractions":[]}

Fragment :
---
${content.substring(0, 8000)}
---`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    }
  )

  if (!response.ok) throw new Error(`Gemini API ${response.status}`)

  const data = await response.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const cleaned = raw
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as { extractions: ExtractionItem[] }
    return parsed.extractions ?? []
  } catch {
    return []
  }
}

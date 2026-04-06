// ============================================================
// Edge Function : detect-conflicts
// M14 Comparaison · M15 Classification · M16 Scoring fiabilité
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Poids de fiabilité par catégorie de document
const CATEGORY_WEIGHTS: Record<string, number> = {
  dmf:         1.0,
  coa:         0.9,
  stability:   0.85,
  protocol:    0.8,
  preclinical: 0.75,
  csr:         0.75,
  other:       0.5,
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { projectId, tenantId } = await req.json() as {
      projectId: string
      tenantId: string
    }

    // Récupérer toutes les extractions du projet
    const { data: extractions, error: extErr } = await supabase
      .from('extractions')
      .select(`
        id, ctd_section, field_key, extracted_value,
        confidence_score, extracted_at,
        documents!inner(doc_category, uploaded_at)
      `)
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)

    if (extErr || !extractions) throw new Error('Impossible de charger les extractions')

    // Grouper par ctd_section + field_key
    const groups = new Map<string, typeof extractions>()
    for (const ext of extractions) {
      const key = `${ext.ctd_section}::${ext.field_key}`
      const group = groups.get(key) ?? []
      group.push(ext)
      groups.set(key, group)
    }

    // Supprimer les anciens conflits non résolus pour ce projet
    await supabase
      .from('conflicts')
      .delete()
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .eq('resolved', false)

    const conflictsToInsert = []
    const entriesToInsert = []

    for (const [groupKey, items] of groups.entries()) {
      if (items.length === 0) continue

      // M16 — Calculer le score de fiabilité pour chaque extraction
      const scored = items.map(item => {
        const docCategory = (item.documents as unknown as { doc_category: string })?.doc_category ?? 'other'
        const docDate = new Date((item.documents as unknown as { uploaded_at: string })?.uploaded_at ?? 0).getTime()
        const nowTime = Date.now()
        const ageMonths = (nowTime - docDate) / (1000 * 60 * 60 * 24 * 30)
        const recencyScore = Math.max(0, 1 - ageMonths / 24) // Décroît sur 24 mois

        const reliability =
          (item.confidence_score ?? 0) * 40 +
          (CATEGORY_WEIGHTS[docCategory] ?? 0.5) * 30 +
          recencyScore * 20

        return { ...item, reliability_score: Math.round(reliability) }
      })

      // Mettre à jour les scores de fiabilité
      for (const s of scored) {
        await supabase
          .from('extractions')
          .update({ reliability_score: s.reliability_score })
          .eq('id', s.id)
      }

      if (items.length === 1) {
        // Un seul résultat — entrée directe dans le formulaire (pending)
        const [ctd_section, field_key] = groupKey.split('::')
        entriesToInsert.push({
          tenant_id: tenantId,
          project_id: projectId,
          ctd_section,
          field_key,
          field_value: items[0].extracted_value,
          source_extraction_id: items[0].id,
          entry_status: 'pending',
          review_status: 'draft',
        })
        continue
      }

      // M14 — Comparer les valeurs
      const [ctd_section, field_key] = groupKey.split('::')
      const conflictType = detectConflictType(items.map(i => i.extracted_value))
      const extractionIds = items.map(i => i.id)

      // M15 — Classification et insertion conflit
      if (conflictType === 'identical') {
        // Toutes identiques → suggestion avec best score
        const best = scored.sort((a, b) => b.reliability_score - a.reliability_score)[0]
        entriesToInsert.push({
          tenant_id: tenantId,
          project_id: projectId,
          ctd_section,
          field_key,
          field_value: best.extracted_value,
          source_extraction_id: best.id,
          entry_status: 'pending',
          review_status: 'draft',
        })
      }

      // Insérer le conflit (même pour identical — pour traçabilité)
      conflictsToInsert.push({
        tenant_id: tenantId,
        project_id: projectId,
        ctd_section,
        field_key,
        conflict_type: conflictType,
        extraction_ids: extractionIds,
        resolved: conflictType === 'identical', // Auto-résolu si identique
        chosen_extraction_id: conflictType === 'identical'
          ? scored.sort((a, b) => b.reliability_score - a.reliability_score)[0].id
          : null,
      })
    }

    // Insérer en batch
    if (conflictsToInsert.length > 0) {
      await supabase.from('conflicts').insert(conflictsToInsert)
    }
    if (entriesToInsert.length > 0) {
      // Upsert pour ne pas dupliquer
      await supabase.from('ctd_form_entries').upsert(entriesToInsert, {
        onConflict: 'project_id,ctd_section,field_key',
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        conflictsDetected: conflictsToInsert.length,
        entriesCreated: entriesToInsert.length,
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

// ─── M14 — Algorithme de détection de conflit ─────────────
function detectConflictType(values: string[]): 'identical' | 'warning' | 'blocking' {
  if (values.length <= 1) return 'identical'

  const uniqueVals = [...new Set(values.map(v => v.trim().toLowerCase()))]
  if (uniqueVals.length === 1) return 'identical'

  // Tenter comparaison numérique
  const numerics = values
    .map(v => parseFloat(v.replace(',', '.')))
    .filter(n => !isNaN(n))

  if (numerics.length === values.length && numerics.length > 1) {
    const min = Math.min(...numerics)
    const max = Math.max(...numerics)
    const relDiff = min > 0 ? (max - min) / min : 1
    if (relDiff < 0.01) return 'identical'
    if (relDiff < 0.10) return 'warning'
    return 'blocking'
  }

  // Comparaison textuelle : Levenshtein simplifié
  const base = uniqueVals[0]
  const allSimilar = uniqueVals.every(v => levenshteinRatio(base, v) > 0.95)
  if (allSimilar) return 'identical'

  const mostSimilar = uniqueVals.every(v => levenshteinRatio(base, v) > 0.75)
  return mostSimilar ? 'warning' : 'blocking'
}

function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  const dist = levenshtein(a, b)
  return 1 - dist / maxLen
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
  return dp[m][n]
}

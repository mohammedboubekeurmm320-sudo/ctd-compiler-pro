// ============================================================
// Edge Function : export-ctd
// M22 Contrôle qualité · M21 Export PDF + eCTD XML
// Runtime : Deno (Supabase Edge Functions)
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Non authentifié')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) throw new Error('Token invalide')

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) throw new Error('Tenant non trouvé')

    // Seuls approver et admin peuvent exporter
    if (!['approver', 'admin', 'super_admin'].includes(profile.role)) {
      throw new Error('Droits insuffisants pour exporter')
    }

    const { projectId } = await req.json() as { projectId: string }

    // Charger le projet
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('tenant_id', profile.tenant_id)
      .single()

    if (!project) throw new Error('Projet introuvable')

    // ── M22 — Contrôle qualité ─────────────────────────────
    const qcChecks = await runQualityChecks(supabase, projectId, profile.tenant_id, project)

    const qcPassed = qcChecks.every(c => c.passed)
    const qcReport = {
      generated_at: new Date().toISOString(),
      passed: qcPassed,
      checks: qcChecks,
    }

    // Sauvegarder le rapport QC
    await supabase.from('projects').update({ qc_report: qcReport }).eq('id', projectId)

    if (!qcPassed) {
      return new Response(
        JSON.stringify({ success: false, qcReport, error: 'Contrôle qualité échoué' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── M21 — Génération du contenu CTD ───────────────────
    const { data: entries } = await supabase
      .from('ctd_form_entries')
      .select('*')
      .eq('project_id', projectId)
      .eq('review_status', 'approved')
      .order('ctd_section')

    // Générer le contenu selon l'autorité
    const ctdContent = generateCTDContent(project, entries ?? [], project.ctd_profile)

    // Générer XML backbone eCTD (EMA/FDA)
    let xmlContent: string | null = null
    if (['EMA', 'FDA'].includes(project.regulatory_authority)) {
      xmlContent = generateECTDXml(project, entries ?? [])
    }

    // Stocker les fichiers dans Storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const basePath = `${profile.tenant_id}/${projectId}/exports/${timestamp}`

    await supabase.storage.from('documents').upload(
      `${basePath}/ctd_content.json`,
      new Blob([JSON.stringify(ctdContent, null, 2)], { type: 'application/json' })
    )

    if (xmlContent) {
      await supabase.storage.from('documents').upload(
        `${basePath}/ectd_backbone.xml`,
        new Blob([xmlContent], { type: 'application/xml' })
      )
    }

    // Audit trail
    await supabase.from('audit_log').insert({
      tenant_id: profile.tenant_id,
      project_id: projectId,
      user_id: user.id,
      action: 'export',
      entity_type: 'project',
      entity_id: projectId,
      new_value: {
        format: project.regulatory_authority,
        sections_count: entries?.length ?? 0,
        export_path: basePath,
        qc_passed: true,
      },
    })

    // Mettre à jour le statut du projet
    await supabase.from('projects').update({ status: 'exported' }).eq('id', projectId)

    // Générer URLs signées (valides 1h)
    const { data: jsonUrl } = await supabase.storage.from('documents')
      .createSignedUrl(`${basePath}/ctd_content.json`, 3600)

    const signedUrls: Record<string, string> = {
      json: jsonUrl?.signedUrl ?? '',
    }

    if (xmlContent) {
      const { data: xmlUrl } = await supabase.storage.from('documents')
        .createSignedUrl(`${basePath}/ectd_backbone.xml`, 3600)
      signedUrls.xml = xmlUrl?.signedUrl ?? ''
    }

    return new Response(
      JSON.stringify({
        success: true,
        qcReport,
        signedUrls,
        entriesExported: entries?.length ?? 0,
        authority: project.regulatory_authority,
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

// ── M22 — Vérifications QC ────────────────────────────────
async function runQualityChecks(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  tenantId: string,
  project: Record<string, unknown>
): Promise<Array<{ name: string; passed: boolean; details: string }>> {
  const checks = []

  // 1. Aucun conflit bloquant non résolu
  const { count: blockingCount } = await supabase
    .from('conflicts')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
    .eq('conflict_type', 'blocking')
    .eq('resolved', false)

  checks.push({
    name: 'Absence de conflits bloquants',
    passed: (blockingCount ?? 0) === 0,
    details: blockingCount ? `${blockingCount} conflit(s) bloquant(s) non résolu(s)` : 'OK',
  })

  // 2. Toutes les sections obligatoires ont au moins une entrée approuvée
  const requiredSections = (project.ctd_profile as { sections: Array<{ code: string; required: boolean }> })
    ?.sections?.filter(s => s.required) ?? []

  const { data: approvedEntries } = await supabase
    .from('ctd_form_entries')
    .select('ctd_section')
    .eq('project_id', projectId)
    .eq('review_status', 'approved')

  const approvedSectionCodes = new Set((approvedEntries ?? []).map(e => (e as { ctd_section: string }).ctd_section))
  const missingSections = requiredSections.filter(s => !approvedSectionCodes.has(s.code))

  checks.push({
    name: 'Sections obligatoires complètes',
    passed: missingSections.length === 0,
    details: missingSections.length > 0
      ? `Sections manquantes : ${missingSections.map(s => s.code).join(', ')}`
      : 'Toutes les sections obligatoires sont approuvées',
  })

  // 3. Workflow respecté — aucune entrée en statut 'pending'
  const { count: pendingCount } = await supabase
    .from('ctd_form_entries')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('entry_status', 'pending')

  checks.push({
    name: 'Validation humaine complète',
    passed: (pendingCount ?? 0) === 0,
    details: pendingCount
      ? `${pendingCount} champ(s) en attente de validation`
      : 'Tous les champs ont été validés',
  })

  return checks
}

// ── M21 — Génération contenu CTD structuré ────────────────
function generateCTDContent(
  project: Record<string, unknown>,
  entries: Array<Record<string, unknown>>,
  ctdProfile: { sections: Array<{ code: string; title: string }> } | null
): Record<string, unknown> {
  const sections: Record<string, unknown> = {}

  for (const section of (ctdProfile?.sections ?? [])) {
    const sectionEntries = entries.filter(e => e.ctd_section === section.code)
    if (sectionEntries.length === 0) continue

    sections[section.code] = {
      title: section.title,
      fields: sectionEntries.reduce((acc, e) => {
        acc[e.field_key as string] = {
          value: e.field_value,
          status: e.review_status,
          approved_by: e.approved_by,
          approved_at: e.approved_at,
        }
        return acc
      }, {} as Record<string, unknown>),
    }
  }

  return {
    metadata: {
      project_name: project.name,
      molecule: project.molecule_name,
      ctd_type: project.ctd_type,
      regulatory_authority: project.regulatory_authority,
      export_date: new Date().toISOString(),
      standard: 'ICH M4 CTD',
    },
    sections,
  }
}

// ── Génération XML backbone eCTD ──────────────────────────
function generateECTDXml(
  project: Record<string, unknown>,
  entries: Array<Record<string, unknown>>
): string {
  const sectionCodes = [...new Set(entries.map(e => e.ctd_section as string))]

  const leafNodes = sectionCodes.map(code => {
    const entriesForSection = entries.filter(e => e.ctd_section === code)
    return `    <leaf ID="${code}" xlink:href="${code}/index.xml" operation="new">
      <title>${code} - ${entriesForSection.length} field(s)</title>
    </leaf>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<ectd:ectd xmlns:ectd="urn:hl7-org:v3"
           xmlns:xlink="http://www.w3.org/1999/xlink">
  <ectd:regional>
    <ectd:us-regional>
      <ectd:application-set>
        <ectd:application>
          <ectd:drug-name>${project.molecule_name}</ectd:drug-name>
          <ectd:applicant>${project.name}</ectd:applicant>
        </ectd:application>
      </ectd:application-set>
    </ectd:us-regional>
  </ectd:regional>
  <ectd:sequence>
    <ectd:number>0001</ectd:number>
    <ectd:sequence-description>Initial Submission</ectd:sequence-description>
    <ectd:regulatory-activity>
      <ectd:regulatory-activity-type>${project.regulatory_authority === 'FDA' ? 'NDA' : 'MAA'}</ectd:regulatory-activity-type>
    </ectd:regulatory-activity>
    <ectd:submission>
      <ectd:subject>
        <ectd:section>
${leafNodes}
        </ectd:section>
      </ectd:subject>
    </ectd:submission>
  </ectd:sequence>
</ectd:ectd>`
}

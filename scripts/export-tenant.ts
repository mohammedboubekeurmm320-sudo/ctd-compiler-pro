// ============================================================
// M25 — Script export-tenant
// Exporte toutes les données d'un tenant pour migration
// Usage : npx tsx scripts/export-tenant.ts --tenant-id UUID
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const args = process.argv.slice(2)
const tenantIdIndex = args.indexOf('--tenant-id')
const tenantId = tenantIdIndex !== -1 ? args[tenantIdIndex + 1] : null

if (!tenantId) {
  console.error('Usage: npx tsx scripts/export-tenant.ts --tenant-id UUID')
  process.exit(1)
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Variables VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function exportTenant(tenantId: string) {
  console.log(`\n🚀 Export du tenant ${tenantId}...`)

  const tables = [
    'tenants', 'profiles', 'projects', 'documents',
    'extractions', 'conflicts', 'ctd_form_entries', 'audit_log',
  ] as const

  const exportData: Record<string, unknown[]> = {}

  for (const table of tables) {
    process.stdout.write(`  Exportation ${table}...`)

    const query = table === 'tenants'
      ? supabase.from(table).select('*').eq('id', tenantId)
      : supabase.from(table).select('*').eq('tenant_id', tenantId)

    const { data, error } = await query

    if (error) {
      console.error(`\n  ❌ Erreur sur ${table}: ${error.message}`)
      continue
    }

    exportData[table] = data ?? []
    console.log(` ${exportData[table].length} enregistrements`)
  }

  // Créer le dossier exports
  mkdirSync('exports', { recursive: true })

  const date = new Date().toISOString().split('T')[0]
  const filename = join('exports', `tenant_${tenantId}_${date}.json`)

  writeFileSync(
    filename,
    JSON.stringify({
      export_date: new Date().toISOString(),
      tenant_id: tenantId,
      version: '1.0',
      data: exportData,
    }, null, 2),
    'utf-8'
  )

  const totalRecords = Object.values(exportData).reduce((sum, arr) => sum + arr.length, 0)
  console.log(`\n✅ Export terminé : ${totalRecords} enregistrements → ${filename}`)
  console.log('\nPour importer sur la nouvelle base :')
  console.log(`  npx tsx scripts/import-tenant.ts --file ${filename}`)
}

exportTenant(tenantId).catch(err => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})

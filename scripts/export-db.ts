#!/usr/bin/env npx ts-node
// ============================================================
// M25 — Script export-db
// Exporte toutes les données d'un tenant au format JSON
// Usage : npx ts-node scripts/export-db.ts --tenant-id=<uuid>
// ============================================================

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const args = process.argv.slice(2)
const tenantId = args.find(a => a.startsWith('--tenant-id='))?.split('=')[1]
const outputDir = args.find(a => a.startsWith('--output='))?.split('=')[1] ?? './backup'

if (!tenantId) {
  console.error('Usage: npx ts-node scripts/export-db.ts --tenant-id=<uuid> [--output=./backup]')
  process.exit(1)
}

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Variables VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function exportTenant(tenantId: string): Promise<void> {
  console.log(`\nExport du tenant : ${tenantId}`)
  console.log(`Dossier de sortie : ${outputDir}\n`)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const tables = [
    'tenants', 'profiles', 'projects', 'documents',
    'extractions', 'conflicts', 'ctd_form_entries', 'audit_log',
  ]

  const exportData: Record<string, unknown[]> = {}
  let totalRows = 0

  for (const table of tables) {
    process.stdout.write(`  Exportation ${table}... `)

    const query = table === 'tenants'
      ? supabase.from(table).select('*').eq('id', tenantId)
      : supabase.from(table).select('*').eq('tenant_id', tenantId)

    const { data, error } = await query

    if (error) {
      console.error(`ERREUR: ${error.message}`)
      continue
    }

    exportData[table] = data ?? []
    totalRows += (data ?? []).length
    console.log(`${(data ?? []).length} lignes`)
  }

  const exportPayload = {
    metadata: {
      tenant_id: tenantId,
      exported_at: new Date().toISOString(),
      total_rows: totalRows,
      tables: Object.keys(exportData),
      version: '1.0',
    },
    data: exportData,
  }

  const fileName = `ctd_export_${tenantId}_${new Date().toISOString().split('T')[0]}.json`
  const filePath = path.join(outputDir, fileName)

  fs.writeFileSync(filePath, JSON.stringify(exportPayload, null, 2))

  console.log(`\nExport terminé :`)
  console.log(`  Fichier : ${filePath}`)
  console.log(`  Lignes  : ${totalRows}`)
  console.log(`  Taille  : ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB`)
}

exportTenant(tenantId).catch(err => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})

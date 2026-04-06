// ============================================================
// Types globaux — CTD Compiler Pro
// Importés partout, jamais redéfinis localement
// ============================================================

// ─── Rôles ────────────────────────────────────────────────
export type UserRole = 'super_admin' | 'admin' | 'approver' | 'reviewer' | 'redactor'

export type TenantStatus = 'active' | 'suspended'
export type UserStatus = 'active' | 'suspended'

// ─── Tenant ────────────────────────────────────────────────
export interface Tenant {
  id: string
  name: string
  slug: string
  status: TenantStatus
  created_at: string
  created_by: string | null
}

// ─── Profile ───────────────────────────────────────────────
export interface Profile {
  id: string
  tenant_id: string | null
  full_name: string
  role: UserRole
  status: UserStatus
  created_at: string
}

// ─── Project ───────────────────────────────────────────────
export type CTDType = 'M2' | 'M3' | 'M4' | 'M5'
export type RegulatoryAuthority = 'EMA' | 'FDA' | 'ANSM' | 'ASDP' | 'other'
export type ProjectStatus = 'draft' | 'in_review' | 'approved' | 'exported'

export interface Project {
  id: string
  tenant_id: string
  name: string
  molecule_name: string
  ctd_type: CTDType
  regulatory_authority: RegulatoryAuthority
  status: ProjectStatus
  ctd_profile: CTDProfile | null
  qc_report: QCReport | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface CTDProfile {
  sections: CTDSection[]
}

export interface CTDSection {
  code: string        // ex: "3.2.S.1"
  title: string       // ex: "General Information"
  required: boolean
  fields: CTDField[]
}

export interface CTDField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select'
  required: boolean
  options?: string[]
  unit?: string
  ich_reference?: string
}

// ─── Document ──────────────────────────────────────────────
export type FileType = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt'
export type DocCategory = 'dmf' | 'stability' | 'coa' | 'protocol' | 'preclinical' | 'csr' | 'other'
export type DocumentStatus = 'uploaded' | 'parsed' | 'extracted' | 'error'

export interface Document {
  id: string
  tenant_id: string
  project_id: string
  file_name: string
  file_path: string
  file_type: FileType
  file_size_bytes: number | null
  file_hash: string
  doc_category: DocCategory
  doc_category_confirmed: boolean
  category_confidence: number | null
  status: DocumentStatus
  error_message: string | null
  uploaded_by: string
  uploaded_at: string
}

// ─── Extraction ────────────────────────────────────────────
export interface Extraction {
  id: string
  tenant_id: string
  document_id: string
  project_id: string
  ctd_section: string
  field_key: string
  extracted_value: string
  source_page: number | null
  source_context: string | null
  confidence_score: number
  reliability_score: number | null
  llm_model: string
  extracted_at: string
}

// ─── Conflict ──────────────────────────────────────────────
export type ConflictType = 'identical' | 'warning' | 'blocking'

export interface Conflict {
  id: string
  tenant_id: string
  project_id: string
  ctd_section: string
  field_key: string
  conflict_type: ConflictType
  extraction_ids: string[]
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  chosen_extraction_id: string | null
  annotation: string | null
  created_at: string
}

// ─── CTD Form Entry ────────────────────────────────────────
export type EntryStatus = 'pending' | 'accepted' | 'modified' | 'rejected'
export type ReviewStatus = 'draft' | 'submitted' | 'reviewed' | 'approved'

export interface CTDFormEntry {
  id: string
  tenant_id: string
  project_id: string
  ctd_section: string
  field_key: string
  field_value: string | null
  source_extraction_id: string | null
  entry_status: EntryStatus
  review_status: ReviewStatus
  reviewed_by: string | null
  reviewed_at: string | null
  approved_by: string | null
  approved_at: string | null
  annotation: string | null
  updated_at: string
}

// ─── Audit Log ─────────────────────────────────────────────
export type AuditAction = 'create' | 'update' | 'submit' | 'review' | 'approve' | 'reject' | 'export' | 'login' | 'delete'
export type AuditEntityType = 'project' | 'document' | 'extraction' | 'ctd_entry' | 'conflict' | 'tenant' | 'profile'

export interface AuditLog {
  id: string
  tenant_id: string
  project_id: string | null
  user_id: string
  action: AuditAction
  entity_type: AuditEntityType
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

// ─── LLM ───────────────────────────────────────────────────
export interface ExtractionItem {
  ctd_section: string
  field_key: string
  extracted_value: string
  confidence: number
  source_context: string
}

export interface ExtractionResult {
  extractions: ExtractionItem[]
  model: string
  tokens_used?: number
}

export interface QualificationResult {
  category: DocCategory
  confidence: number
  reasoning: string
}

export interface ConflictAnalysis {
  field_key: string
  ctd_section: string
  conflict_type: ConflictType
  values: Array<{
    extraction_id: string
    value: string
    confidence: number
  }>
}

// ─── QC Report ─────────────────────────────────────────────
export interface QCReport {
  generated_at: string
  passed: boolean
  checks: QCCheck[]
}

export interface QCCheck {
  name: string
  passed: boolean
  details: string
}

// ─── Tenant Settings ───────────────────────────────────────
export interface TenantSettings {
  id: string
  tenant_id: string
  nas_path: string | null
  dms_url: string | null
  dms_api_key: string | null
  llm_config: Record<string, unknown> | null
  updated_at: string
}

-- ============================================================
-- Migration 003 — Bucket exports + indexes de performance
-- ============================================================

-- Bucket exports (résultats générés)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false,
  104857600,
  ARRAY[
    'application/pdf',
    'application/xml',
    'application/json',
    'application/zip',
    'text/plain'
  ]
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "tenant_read_exports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exports'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "service_write_exports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exports');

-- ============================================================
-- Indexes supplémentaires pour la performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_extractions_tenant_section
  ON public.extractions(tenant_id, ctd_section, field_key);

CREATE INDEX IF NOT EXISTS idx_conflicts_tenant_unresolved
  ON public.conflicts(tenant_id, project_id, resolved)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_ctd_entries_review_status
  ON public.ctd_form_entries(project_id, review_status);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_action
  ON public.audit_log(user_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_hash
  ON public.documents(project_id, file_hash);

-- ============================================================
-- Vue : progression par projet (utilisée par le dashboard)
-- ============================================================

CREATE OR REPLACE VIEW public.project_progress AS
SELECT
  p.id AS project_id,
  p.tenant_id,
  p.name,
  p.status,
  COUNT(DISTINCT d.id) AS total_documents,
  COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'extracted') AS extracted_documents,
  COUNT(DISTINCT e.id) AS total_entries,
  COUNT(DISTINCT e.id) FILTER (WHERE e.entry_status IN ('accepted', 'modified')) AS validated_entries,
  COUNT(DISTINCT e.id) FILTER (WHERE e.review_status = 'approved') AS approved_entries,
  COUNT(DISTINCT c.id) FILTER (WHERE c.conflict_type = 'blocking' AND c.resolved = false) AS blocking_conflicts,
  COUNT(DISTINCT c.id) FILTER (WHERE c.conflict_type = 'warning' AND c.resolved = false) AS warning_conflicts
FROM public.projects p
LEFT JOIN public.documents d ON d.project_id = p.id
LEFT JOIN public.ctd_form_entries e ON e.project_id = p.id
LEFT JOIN public.conflicts c ON c.project_id = p.id
GROUP BY p.id, p.tenant_id, p.name, p.status;

-- RLS sur la vue
ALTER VIEW public.project_progress SET (security_invoker = true);

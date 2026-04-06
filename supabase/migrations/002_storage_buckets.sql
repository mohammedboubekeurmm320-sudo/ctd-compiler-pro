-- ============================================================
-- Migration 002 — Storage buckets et politiques
-- ============================================================

-- Bucket documents (privé — accès via RLS uniquement)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'application/json'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Politique : upload par utilisateur authentifié dans son tenant
CREATE POLICY "tenant_upload_documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- Politique : lecture par utilisateur du même tenant
CREATE POLICY "tenant_read_documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- Politique : suppression par admin uniquement
CREATE POLICY "admin_delete_documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND (
    SELECT role FROM public.profiles WHERE id = auth.uid()
  ) IN ('admin', 'super_admin')
);

-- ============================================================
-- Migration 001 — Schéma CTD Compiler Pro
-- Multi-tenant · RLS activé sur toutes les tables
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE : tenants
-- ============================================================
CREATE TABLE public.tenants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Super admin voit tous les tenants
CREATE POLICY "super_admin_all_tenants" ON public.tenants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Admin voit uniquement son tenant
CREATE POLICY "admin_own_tenant" ON public.tenants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tenant_id = tenants.id
    )
  );

-- ============================================================
-- TABLE : profiles
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  tenant_id   UUID REFERENCES public.tenants ON DELETE CASCADE,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'redactor'
              CHECK (role IN ('super_admin', 'admin', 'approver', 'reviewer', 'redactor')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur voit son propre profil
CREATE POLICY "own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin voit les profils de son tenant
CREATE POLICY "admin_tenant_profiles" ON public.profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid()
      AND p.tenant_id = profiles.tenant_id
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- Super admin voit tous les profils
CREATE POLICY "super_admin_all_profiles" ON public.profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
    )
  );

-- Trigger : création automatique du profil lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'redactor')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABLE : projects
-- ============================================================
CREATE TABLE public.projects (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  molecule_name        TEXT NOT NULL,
  ctd_type             TEXT NOT NULL CHECK (ctd_type IN ('M2', 'M3', 'M4', 'M5')),
  regulatory_authority TEXT NOT NULL CHECK (regulatory_authority IN ('EMA', 'FDA', 'ANSM', 'ASDP', 'other')),
  status               TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'in_review', 'approved', 'exported')),
  ctd_profile          JSONB,
  qc_report            JSONB,
  created_by           UUID NOT NULL REFERENCES public.profiles,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_projects" ON public.projects
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- TABLE : documents
-- ============================================================
CREATE TABLE public.documents (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id              UUID NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  project_id             UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  file_name              TEXT NOT NULL,
  file_path              TEXT NOT NULL,
  file_type              TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'xlsx', 'csv', 'txt')),
  file_size_bytes        BIGINT,
  file_hash              TEXT NOT NULL,
  doc_category           TEXT NOT NULL DEFAULT 'other'
                         CHECK (doc_category IN ('dmf', 'stability', 'coa', 'protocol', 'preclinical', 'csr', 'other')),
  doc_category_confirmed BOOLEAN NOT NULL DEFAULT false,
  category_confidence    NUMERIC(3,2),
  status                 TEXT NOT NULL DEFAULT 'uploaded'
                         CHECK (status IN ('uploaded', 'parsed', 'extracted', 'error')),
  error_message          TEXT,
  uploaded_by            UUID NOT NULL REFERENCES public.profiles,
  uploaded_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_documents" ON public.documents
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- TABLE : extractions
-- ============================================================
CREATE TABLE public.extractions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  document_id      UUID NOT NULL REFERENCES public.documents ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  ctd_section      TEXT NOT NULL,
  field_key        TEXT NOT NULL,
  extracted_value  TEXT NOT NULL,
  source_page      INT,
  source_context   TEXT,
  confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0,
  reliability_score NUMERIC(5,2),
  llm_model        TEXT NOT NULL,
  extracted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_extractions" ON public.extractions
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- TABLE : conflicts
-- ============================================================
CREATE TABLE public.conflicts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  ctd_section           TEXT NOT NULL,
  field_key             TEXT NOT NULL,
  conflict_type         TEXT NOT NULL CHECK (conflict_type IN ('identical', 'warning', 'blocking')),
  extraction_ids        UUID[] NOT NULL,
  resolved              BOOLEAN NOT NULL DEFAULT false,
  resolved_by           UUID REFERENCES public.profiles,
  resolved_at           TIMESTAMPTZ,
  chosen_extraction_id  UUID REFERENCES public.extractions,
  annotation            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_conflicts" ON public.conflicts
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- TABLE : ctd_form_entries
-- ============================================================
CREATE TABLE public.ctd_form_entries (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  ctd_section           TEXT NOT NULL,
  field_key             TEXT NOT NULL,
  field_value           TEXT,
  source_extraction_id  UUID REFERENCES public.extractions,
  entry_status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (entry_status IN ('pending', 'accepted', 'modified', 'rejected')),
  review_status         TEXT NOT NULL DEFAULT 'draft'
                        CHECK (review_status IN ('draft', 'submitted', 'reviewed', 'approved')),
  reviewed_by           UUID REFERENCES public.profiles,
  reviewed_at           TIMESTAMPTZ,
  approved_by           UUID REFERENCES public.profiles,
  approved_at           TIMESTAMPTZ,
  annotation            TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, ctd_section, field_key)
);

ALTER TABLE public.ctd_form_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_ctd_form_entries" ON public.ctd_form_entries
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- TABLE : audit_log
-- ============================================================
CREATE TABLE public.audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  project_id   UUID,
  user_id      UUID NOT NULL REFERENCES public.profiles,
  action       TEXT NOT NULL
               CHECK (action IN ('create', 'update', 'submit', 'review', 'approve', 'reject', 'export', 'login', 'delete')),
  entity_type  TEXT NOT NULL
               CHECK (entity_type IN ('project', 'document', 'extraction', 'ctd_entry', 'conflict', 'tenant', 'profile')),
  entity_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log : lecture seule pour reviewer et approver, full pour admin/super_admin
CREATE POLICY "tenant_audit_log_read" ON public.audit_log
  FOR SELECT USING (
    tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('admin', 'approver', 'reviewer', 'super_admin')
  );

CREATE POLICY "tenant_audit_log_insert" ON public.audit_log
  FOR INSERT WITH CHECK (
    tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- TABLE : tenant_settings
-- ============================================================
CREATE TABLE public.tenant_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL UNIQUE REFERENCES public.tenants ON DELETE CASCADE,
  nas_path    TEXT,
  dms_url     TEXT,
  dms_api_key TEXT,
  llm_config  JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_tenant_settings" ON public.tenant_settings
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('admin', 'super_admin')
  );

-- ============================================================
-- INDEX pour les performances
-- ============================================================
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX idx_projects_tenant_id ON public.projects(tenant_id);
CREATE INDEX idx_documents_project_id ON public.documents(project_id);
CREATE INDEX idx_documents_tenant_id ON public.documents(tenant_id);
CREATE INDEX idx_extractions_project_id ON public.extractions(project_id);
CREATE INDEX idx_extractions_field_key ON public.extractions(project_id, ctd_section, field_key);
CREATE INDEX idx_conflicts_project_id ON public.conflicts(project_id);
CREATE INDEX idx_conflicts_resolved ON public.conflicts(project_id, resolved);
CREATE INDEX idx_ctd_form_entries_project ON public.ctd_form_entries(project_id, ctd_section);
CREATE INDEX idx_audit_log_tenant ON public.audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_project ON public.audit_log(project_id, created_at DESC);

-- Fonction updated_at automatique
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER ctd_entries_updated_at
  BEFORE UPDATE ON public.ctd_form_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

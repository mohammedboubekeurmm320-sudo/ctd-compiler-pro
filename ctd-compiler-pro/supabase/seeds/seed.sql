-- ============================================================
-- Seed — Données de démonstration CTD Compiler Pro
-- NE PAS exécuter en production
-- ============================================================

-- Tenant de démonstration
INSERT INTO public.tenants (id, name, slug, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'PharmaCorp Demo',
  'pharmacorp-demo',
  'active'
);

-- NOTE : Les utilisateurs sont créés via Supabase Auth.
-- Après création via auth, mettre à jour manuellement :
-- UPDATE profiles SET tenant_id = '00000000-...', role = 'admin' WHERE id = '<user_id>';

# CTD Compiler Pro

Application SaaS multi-tenant de compilation automatique de dossiers CTD
(Common Technical Document) selon la structure ICH M4.

## Stack technique
- **Frontend** : React 18 · TypeScript · Vite · TailwindCSS · Zustand
- **Backend** : Supabase (PostgreSQL · Auth · Storage · Edge Functions)
- **LLM** : Google Gemini 1.5 Flash (MVP) → Ollama on-premise (Phase 2)
- **Déploiement** : Netlify + Supabase cloud

## Conformité réglementaire
- Structure ICH M4 (CTD)
- ICH Q1A (stabilité)
- 21 CFR Part 11 (audit trail)
- Modules supportés : M2 · M3 (CMC) · M4 (Préclinique) · M5 (Clinique)
- Autorités : EMA · FDA · ANSM · ASDP

## Démarrage rapide

```bash
# Cloner et installer
git clone https://github.com/YOUR_USERNAME/ctd-compiler-pro.git
cd ctd-compiler-pro
npm install

# Configurer l'environnement
cp .env.example .env
# Remplir les variables dans .env

# Démarrer en développement
npm run dev

# Tests
npm run test

# Build production
npm run build
```

## Architecture des modules

| Groupe | Modules | Description |
|---|---|---|
| G0 — Fondations | M00, M24 | DB multi-tenant, RLS, LLM abstrait |
| G1 — Auth | M23, M00b | Authentification, rôles, super admin |
| G2 — Projet | M01, M02, M03 | Création, profil CTD, tableau de bord |
| G3 — Ingestion | M04–M08 | Upload, qualification, registre |
| G4 — Extraction | M09–M13 | Parsing, LLM, mapping sections |
| G5 — Conflits | M14–M16 | Détection, classification, scoring |
| G6 — Formulaire | M17–M19 | CTD form, revue humaine, complétude |
| G7 — Export | M20–M22 | Audit trail, QC, eCTD export |
| G8 — Migration | M25 | Préparation phase offline |

## Hiérarchie des rôles

```
Super Admin (plateforme)
└── Admin Société (par tenant)
    ├── Approbateur → exporte le CTD
    ├── Réviseur    → contrôle les sections
    └── Rédacteur   → remplit le formulaire
```

## Migration offline

Voir [migration/README.md](migration/README.md) pour la procédure complète
de migration vers une infrastructure on-premise (Phase 2).

---

*Version 1.0 · Conforme ICH M4 · 21 CFR Part 11*

# CTD Compiler Pro — Guide de déploiement et migration

## Déploiement MVP (Phase 1 — Online)

### Prérequis
- Compte Supabase (free tier)
- Compte Netlify (free tier)
- Compte GitHub
- Clé API Google Gemini (free tier — console.cloud.google.com)

### Étapes

#### 1. Supabase — Base de données
```bash
# Installer Supabase CLI
npm install -g supabase

# Initialiser et lier au projet
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Appliquer les migrations
supabase db push

# Déployer les Edge Functions
supabase functions deploy extract-document
supabase functions deploy detect-conflicts
supabase functions deploy export-ctd
```

#### 2. Variables d'environnement Supabase (Edge Functions)
Dans le dashboard Supabase → Settings → Edge Functions → Secrets :
```
GEMINI_API_KEY=your_gemini_key
```

#### 3. Supabase Storage — Créer le bucket
```sql
-- Dans l'éditeur SQL Supabase
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Policy : accès par tenant uniquement
CREATE POLICY "tenant_documents_storage" ON storage.objects
  FOR ALL USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = (
      SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );
```

#### 4. GitHub — Repository
```bash
cd ctd-compiler-pro
git init
git add .
git commit -m "[M00] Initial commit — CTD Compiler Pro"
git remote add origin https://github.com/YOUR_USERNAME/ctd-compiler-pro.git
git push -u origin main
```

#### 5. Netlify — Déploiement frontend
1. Connecter le repository GitHub dans Netlify
2. Build command : `npm run build`
3. Publish directory : `dist`
4. Variables d'environnement Netlify :
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_LLM_PROVIDER=gemini
VITE_GEMINI_API_KEY=your_gemini_key
VITE_APP_NAME=CTD Compiler Pro
VITE_APP_VERSION=1.0.0
```

#### 6. Créer le Super Admin
Dans Supabase → Authentication → Users → Add user :
- Email : superadmin@votre-domaine.com
- Puis dans l'éditeur SQL :
```sql
UPDATE public.profiles
SET role = 'super_admin', full_name = 'Super Administrateur'
WHERE id = 'USER_UUID_ICI';
```

---

## Migration Phase 2 — Offline / On-Premise

### Quand migrer ?
Après obtention du financement. La migration ne nécessite aucune réécriture
du code frontend ni de la logique métier.

### Ce qui change

| Composant | Phase 1 (Online) | Phase 2 (Offline) |
|---|---|---|
| Frontend | Netlify | Nginx + Docker |
| Base de données | Supabase PostgreSQL | PostgreSQL 16 on-premise |
| Auth | Supabase Auth | Keycloak ou Supabase self-hosted |
| Storage | Supabase Storage | MinIO |
| Edge Functions | Supabase Deno | FastAPI Python ou Deno Deploy self-hosted |
| LLM | Gemini API | Ollama (Llama 3.3 / Mistral) |

### Étape 1 — Activer OllamaProvider
```env
# Dans .env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.3
```
C'est le seul changement de code nécessaire côté LLM.

### Étape 2 — PostgreSQL on-premise
```bash
# Installer PostgreSQL 16
docker run -d \
  --name ctd-postgres \
  -e POSTGRES_DB=ctd_compiler \
  -e POSTGRES_USER=ctd_user \
  -e POSTGRES_PASSWORD=CHANGE_ME \
  -v ctd_data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:16

# Appliquer les migrations
psql -h localhost -U ctd_user -d ctd_compiler \
  -f supabase/migrations/001_initial_schema.sql
```

### Étape 3 — MinIO (Storage)
```bash
docker run -d \
  --name ctd-minio \
  -e MINIO_ROOT_USER=ctd_admin \
  -e MINIO_ROOT_PASSWORD=CHANGE_ME \
  -v minio_data:/data \
  -p 9000:9000 -p 9001:9001 \
  minio/minio server /data --console-address ":9001"

# Créer le bucket 'documents'
mc alias set ctd http://localhost:9000 ctd_admin CHANGE_ME
mc mb ctd/documents
```

### Étape 4 — Ollama (LLM local)
```bash
# Installer Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Télécharger le modèle (8B params — ~5GB VRAM)
ollama pull llama3.3

# Ou version plus légère
ollama pull mistral:7b
```

### Étape 5 — Docker Compose complet
```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build: .
    ports: ['80:80']
    environment:
      - VITE_SUPABASE_URL=http://localhost:54321
      - VITE_LLM_PROVIDER=ollama

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: ctd_compiler
      POSTGRES_USER: ctd_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - minio_data:/data

  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

volumes:
  postgres_data:
  minio_data:
  ollama_data:
```

---

## Export des données d'un tenant (migration)

```bash
# Installer les dépendances
npm install

# Exporter toutes les données d'un tenant
npx tsx scripts/export-tenant.ts --tenant-id YOUR_TENANT_UUID

# Fichier généré : exports/tenant_YYYY-MM-DD.json
```

---

## Hardware recommandé — Phase 2

| Composant | Minimum | Recommandé |
|---|---|---|
| CPU | 8 cœurs | 16 cœurs |
| RAM | 16 GB | 32 GB |
| VRAM GPU | 8 GB | 16 GB (RTX 3080+) |
| Stockage | 500 GB SSD | 2 TB NVMe |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

Sans GPU : Ollama tourne en mode CPU (10-15x plus lent mais fonctionnel).
Mistral 7B Q4 tourne correctement sur 8 GB RAM sans GPU.

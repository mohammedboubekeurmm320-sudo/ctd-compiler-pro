// ============================================================
// Utilitaires généraux — CTD Compiler Pro
// ============================================================

// ─── Formatage dates ───────────────────────────────────────
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1)  return 'à l\'instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}

// ─── Formatage fichiers ────────────────────────────────────
export function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Calcul SHA-256 ────────────────────────────────────────
export async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Génération de slug ───────────────────────────────────
export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// ─── Truncate texte ────────────────────────────────────────
export function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.substring(0, max) + '…'
}

// ─── Score de confiance en couleur ────────────────────────
export function confidenceColor(score: number): string {
  if (score >= 0.85) return 'text-green-600'
  if (score >= 0.65) return 'text-amber-600'
  return 'text-red-600'
}

export function confidenceLabel(score: number): string {
  if (score >= 0.85) return 'Élevée'
  if (score >= 0.65) return 'Moyenne'
  return 'Faible'
}

// ─── Groupe de sections CTD ───────────────────────────────
export function getSectionGroup(code: string): string {
  if (code.startsWith('3.2.S')) return 'Substance active'
  if (code.startsWith('3.2.P')) return 'Produit fini'
  if (code.startsWith('3.2.A')) return 'Annexes'
  if (code.startsWith('4.2'))   return 'Pharmacologie / Toxicologie'
  if (code.startsWith('5.3'))   return 'Rapports cliniques'
  if (code.startsWith('2.'))    return 'Résumés CTD'
  return 'Autre'
}

// ─── Validation ───────────────────────────────────────────
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 8
}

// ─── Debounce ─────────────────────────────────────────────
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T, delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

// ─── Couleurs par catégorie de document ───────────────────
export const DOC_CATEGORY_COLORS: Record<string, string> = {
  dmf:         'bg-purple-100 text-purple-800',
  stability:   'bg-blue-100 text-blue-800',
  coa:         'bg-amber-100 text-amber-800',
  protocol:    'bg-teal-100 text-teal-800',
  preclinical: 'bg-red-100 text-red-800',
  csr:         'bg-pink-100 text-pink-800',
  other:       'bg-gray-100 text-gray-600',
}

export const DOC_CATEGORY_LABELS: Record<string, string> = {
  dmf:         'DMF',
  stability:   'Stabilité',
  coa:         'CoA',
  protocol:    'Protocole',
  preclinical: 'Préclinique',
  csr:         'CSR',
  other:       'Autre',
}

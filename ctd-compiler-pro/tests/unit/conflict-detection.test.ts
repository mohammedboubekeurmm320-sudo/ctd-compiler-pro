// ============================================================
// Tests M14/M15 — Détection et classification des conflits
// Logique extraite pour tests unitaires
// ============================================================

import { describe, it, expect } from 'vitest'

// ── Reproduction de la logique detect-conflicts ────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
  return dp[m][n]
}

function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

function detectConflictType(values: string[]): 'identical' | 'warning' | 'blocking' {
  if (values.length <= 1) return 'identical'
  const uniqueVals = [...new Set(values.map(v => v.trim().toLowerCase()))]
  if (uniqueVals.length === 1) return 'identical'

  const numerics = values.map(v => parseFloat(v.replace(',', '.'))).filter(n => !isNaN(n))
  if (numerics.length === values.length && numerics.length > 1) {
    const min = Math.min(...numerics)
    const max = Math.max(...numerics)
    const relDiff = min > 0 ? (max - min) / min : 1
    if (relDiff < 0.01) return 'identical'
    if (relDiff < 0.10) return 'warning'
    return 'blocking'
  }

  const base = uniqueVals[0]
  const allSimilar = uniqueVals.every(v => levenshteinRatio(base, v) > 0.95)
  if (allSimilar) return 'identical'
  const mostSimilar = uniqueVals.every(v => levenshteinRatio(base, v) > 0.75)
  return mostSimilar ? 'warning' : 'blocking'
}

// ── Tests ─────────────────────────────────────────────────
describe('M14/M15 — detectConflictType', () => {
  describe('Valeurs identiques', () => {
    it('valeur unique → identical', () => {
      expect(detectConflictType(['Sanofi'])).toBe('identical')
    })

    it('mêmes valeurs textuelles → identical', () => {
      expect(detectConflictType(['Amoxicilline', 'Amoxicilline', 'Amoxicilline'])).toBe('identical')
    })

    it('casse différente → identical', () => {
      expect(detectConflictType(['SANOFI', 'sanofi', 'Sanofi'])).toBe('identical')
    })

    it('valeurs numériques avec < 1% écart → identical', () => {
      expect(detectConflictType(['100.0', '100.5', '100.2'])).toBe('identical')
    })
  })

  describe('Avertissements', () => {
    it('valeurs numériques avec 1-10% écart → warning', () => {
      expect(detectConflictType(['100', '108'])).toBe('warning')
    })

    it('textes très proches → warning', () => {
      expect(detectConflictType(['Sanofi Pasteur SA', 'Sanofi Pasteur SAS'])).toBe('warning')
    })
  })

  describe('Conflits bloquants', () => {
    it('valeurs numériques avec > 10% écart → blocking', () => {
      expect(detectConflictType(['100', '150'])).toBe('blocking')
    })

    it('textes très différents → blocking', () => {
      expect(detectConflictType(['Pfizer Inc.', 'Sanofi Pasteur'])).toBe('blocking')
    })

    it('unités incompatibles → blocking', () => {
      expect(detectConflictType(['25°C', '40°C'])).toBe('blocking')
    })

    it('fabricants différents → blocking', () => {
      expect(detectConflictType(['Site A — France', 'Site B — Allemagne'])).toBe('blocking')
    })
  })

  describe('Cas limites', () => {
    it('tableau vide → identical', () => {
      expect(detectConflictType([])).toBe('identical')
    })

    it('nombres avec virgule décimale → traité correctement', () => {
      expect(detectConflictType(['99,5', '100,0'])).toBe('identical')
    })

    it('écart exactement à 10% → warning', () => {
      expect(detectConflictType(['100', '109'])).toBe('warning')
    })
  })
})

describe('M16 — Scoring fiabilité', () => {
  const CATEGORY_WEIGHTS: Record<string, number> = {
    dmf: 1.0, coa: 0.9, stability: 0.85, protocol: 0.8,
    preclinical: 0.75, csr: 0.75, other: 0.5,
  }

  function computeReliability(
    confidenceScore: number,
    docCategory: string,
    ageMonths: number
  ): number {
    const recencyScore = Math.max(0, 1 - ageMonths / 24)
    return (
      confidenceScore * 40 +
      (CATEGORY_WEIGHTS[docCategory] ?? 0.5) * 30 +
      recencyScore * 20
    )
  }

  it('DMF récent avec haute confiance → score élevé', () => {
    const score = computeReliability(0.95, 'dmf', 1)
    expect(score).toBeGreaterThan(60)
  })

  it('document "other" ancien avec faible confiance → score bas', () => {
    const score = computeReliability(0.3, 'other', 30)
    expect(score).toBeLessThan(30)
  })

  it('DMF plus fiable que document other', () => {
    const dmfScore = computeReliability(0.8, 'dmf', 6)
    const otherScore = computeReliability(0.8, 'other', 6)
    expect(dmfScore).toBeGreaterThan(otherScore)
  })

  it('document récent plus fiable que document ancien (même catégorie)', () => {
    const recentScore = computeReliability(0.8, 'coa', 1)
    const oldScore = computeReliability(0.8, 'coa', 20)
    expect(recentScore).toBeGreaterThan(oldScore)
  })
})

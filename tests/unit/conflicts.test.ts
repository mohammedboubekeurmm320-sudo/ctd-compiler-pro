// ============================================================
// Tests M14/M15/M16 — Détection conflits et scoring
// ============================================================

import { describe, it, expect } from 'vitest'

// Réplication de l'algorithme depuis l'Edge Function pour les tests
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

describe('M14 — Détection de type de conflit', () => {
  describe('Valeurs identiques', () => {
    it('retourne identical pour une seule valeur', () => {
      expect(detectConflictType(['Sanofi'])).toBe('identical')
    })

    it('retourne identical pour valeurs textuelles identiques', () => {
      expect(detectConflictType(['Sanofi Winthrop', 'Sanofi Winthrop', 'Sanofi Winthrop'])).toBe('identical')
    })

    it('retourne identical pour valeurs numériques avec écart < 1%', () => {
      expect(detectConflictType(['419.45', '419.50'])).toBe('identical')
    })
  })

  describe('Avertissements', () => {
    it('retourne warning pour valeurs numériques avec écart entre 1% et 10%', () => {
      expect(detectConflictType(['100', '105'])).toBe('warning')
    })

    it('retourne warning pour textes très similaires', () => {
      expect(detectConflictType(['Sanofi Aventis France', 'Sanofi Aventis FR'])).toBe('warning')
    })
  })

  describe('Conflits bloquants', () => {
    it('retourne blocking pour valeurs numériques avec écart > 10%', () => {
      expect(detectConflictType(['24 mois', '18 mois'])).toBe('blocking')
    })

    it('retourne blocking pour valeurs textuelles très différentes', () => {
      expect(detectConflictType(['Sanofi Winthrop Industrie', 'Pfizer Manufacturing'])).toBe('blocking')
    })

    it('retourne blocking pour conditions contradictoires', () => {
      expect(detectConflictType(['25°C / 60% HR', '30°C / 65% HR'])).toBe('blocking')
    })
  })
})

describe('M16 — Calcul de fiabilité', () => {
  const CATEGORY_WEIGHTS: Record<string, number> = {
    dmf: 1.0, coa: 0.9, stability: 0.85, protocol: 0.8,
    preclinical: 0.75, csr: 0.75, other: 0.5,
  }

  function computeReliability(confidenceScore: number, docCategory: string, ageMonths: number): number {
    const recencyScore = Math.max(0, 1 - ageMonths / 24)
    return (confidenceScore * 40) + ((CATEGORY_WEIGHTS[docCategory] ?? 0.5) * 30) + (recencyScore * 20)
  }

  it('DMF récent avec haute confiance obtient le meilleur score', () => {
    const score = computeReliability(0.95, 'dmf', 0)
    expect(score).toBeGreaterThan(80)
  })

  it('document "other" ancien avec faible confiance obtient le plus bas score', () => {
    const score = computeReliability(0.3, 'other', 24)
    expect(score).toBeLessThan(40)
  })

  it('DMF > CoA > stabilité dans la hiérarchie de fiabilité', () => {
    const scoreDMF = computeReliability(0.9, 'dmf', 3)
    const scoreCoA = computeReliability(0.9, 'coa', 3)
    const scoreStab = computeReliability(0.9, 'stability', 3)
    expect(scoreDMF).toBeGreaterThan(scoreCoA)
    expect(scoreCoA).toBeGreaterThan(scoreStab)
  })

  it('un document récent est plus fiable qu\'un document vieux', () => {
    const scoreRecent = computeReliability(0.85, 'coa', 1)
    const scoreOld = computeReliability(0.85, 'coa', 20)
    expect(scoreRecent).toBeGreaterThan(scoreOld)
  })
})

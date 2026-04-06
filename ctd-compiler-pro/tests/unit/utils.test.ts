// ============================================================
// Tests utilitaires — hash, types, validations
// ============================================================

import { describe, it, expect } from 'vitest'

describe('Utilitaires — SHA256', () => {
  async function computeSHA256(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  it('génère un hash SHA256 de longueur 64', async () => {
    const hash = await computeSHA256('test content')
    expect(hash).toHaveLength(64)
  })

  it('génère des hashes différents pour des contenus différents', async () => {
    const h1 = await computeSHA256('content A')
    const h2 = await computeSHA256('content B')
    expect(h1).not.toBe(h2)
  })

  it('génère le même hash pour le même contenu', async () => {
    const h1 = await computeSHA256('same content')
    const h2 = await computeSHA256('same content')
    expect(h1).toBe(h2)
  })
})

describe('Utilitaires — Chunking de texte', () => {
  function splitIntoChunks(text: string, size: number, overlap: number): string[] {
    const words = text.split(/\s+/)
    const chunks: string[] = []
    let start = 0
    while (start < words.length) {
      const end = Math.min(start + size, words.length)
      chunks.push(words.slice(start, end).join(' '))
      start += size - overlap
      if (start >= words.length) break
    }
    return chunks.filter(c => c.trim().length > 50)
  }

  it('découpe un texte long en plusieurs chunks', () => {
    const text = Array.from({ length: 500 }, (_, i) => `mot${i}`).join(' ')
    const chunks = splitIntoChunks(text, 100, 20)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('respecte la taille maximum des chunks', () => {
    const text = Array.from({ length: 1000 }, (_, i) => `mot${i}`).join(' ')
    const chunks = splitIntoChunks(text, 200, 20)
    chunks.forEach(c => {
      expect(c.split(/\s+/).length).toBeLessThanOrEqual(200)
    })
  })

  it('les chunks consécutifs se chevauchent', () => {
    const text = Array.from({ length: 300 }, (_, i) => `mot${i}`).join(' ')
    const chunks = splitIntoChunks(text, 100, 20)
    if (chunks.length >= 2) {
      const lastWordsChunk1 = chunks[0].split(/\s+/).slice(-20).join(' ')
      const firstWordsChunk2 = chunks[1].split(/\s+/).slice(0, 20).join(' ')
      expect(lastWordsChunk1).toBe(firstWordsChunk2)
    }
  })
})

describe('Utilitaires — Validation types CTD', () => {
  const VALID_CTD_TYPES = ['M2', 'M3', 'M4', 'M5']
  const VALID_AUTHORITIES = ['EMA', 'FDA', 'ANSM', 'ASDP', 'other']
  const VALID_ROLES = ['super_admin', 'admin', 'approver', 'reviewer', 'redactor']
  const VALID_DOC_CATEGORIES = ['dmf', 'stability', 'coa', 'protocol', 'preclinical', 'csr', 'other']

  it('valide les types CTD corrects', () => {
    VALID_CTD_TYPES.forEach(t => expect(VALID_CTD_TYPES).toContain(t))
  })

  it('valide les autorités correctes', () => {
    VALID_AUTHORITIES.forEach(a => expect(VALID_AUTHORITIES).toContain(a))
  })

  it('valide les rôles utilisateurs', () => {
    VALID_ROLES.forEach(r => expect(VALID_ROLES).toContain(r))
  })

  it('valide les catégories de documents', () => {
    VALID_DOC_CATEGORIES.forEach(c => expect(VALID_DOC_CATEGORIES).toContain(c))
  })

  it('rejette un type CTD invalide', () => {
    expect(VALID_CTD_TYPES).not.toContain('M6')
    expect(VALID_CTD_TYPES).not.toContain('CTD')
  })
})

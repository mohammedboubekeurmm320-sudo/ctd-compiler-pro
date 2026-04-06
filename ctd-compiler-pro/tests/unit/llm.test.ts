// ============================================================
// Tests M24 — LLM Provider Factory
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('M24 — getLLMProvider factory', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('retourne GeminiProvider quand LLM_PROVIDER=gemini', async () => {
    vi.stubEnv('LLM_PROVIDER', 'gemini')
    vi.stubEnv('GEMINI_API_KEY', 'test-key')

    const { getLLMProvider, resetLLMProvider } = await import('@/lib/llm/index')
    resetLLMProvider()

    const provider = getLLMProvider()
    expect(provider.name).toBe('gemini')
    expect(provider.model).toBe('gemini-1.5-flash')
    resetLLMProvider()
  })

  it('retourne OllamaProvider quand LLM_PROVIDER=ollama', async () => {
    vi.stubEnv('LLM_PROVIDER', 'ollama')

    const { getLLMProvider, resetLLMProvider } = await import('@/lib/llm/index')
    resetLLMProvider()

    const provider = getLLMProvider()
    expect(provider.name).toBe('ollama')
    resetLLMProvider()
  })

  it('lève une erreur pour un provider inconnu', async () => {
    vi.stubEnv('LLM_PROVIDER', 'unknown')

    const { getLLMProvider, resetLLMProvider } = await import('@/lib/llm/index')
    resetLLMProvider()

    expect(() => getLLMProvider()).toThrow('non supporté')
    resetLLMProvider()
  })

  it('retourne le même singleton sur plusieurs appels', async () => {
    vi.stubEnv('LLM_PROVIDER', 'gemini')
    vi.stubEnv('GEMINI_API_KEY', 'test-key')

    const { getLLMProvider, resetLLMProvider } = await import('@/lib/llm/index')
    resetLLMProvider()

    const p1 = getLLMProvider()
    const p2 = getLLMProvider()
    expect(p1).toBe(p2)
    resetLLMProvider()
  })
})

describe('M24 — GeminiProvider JSON parsing', () => {
  it('parse correctement un JSON avec backticks markdown', async () => {
    const { GeminiProvider } = await import('@/lib/llm/GeminiProvider')
    const provider = new GeminiProvider('test-key')

    const raw = '```json\n{"extractions":[]}\n```'
    // Accès au parser privé via cast
    const parsed = (provider as unknown as { _parseJSON: (s: string) => unknown })._parseJSON(raw)
    expect(parsed).toEqual({ extractions: [] })
  })

  it('retourne objet vide si JSON invalide', async () => {
    const { GeminiProvider } = await import('@/lib/llm/GeminiProvider')
    const provider = new GeminiProvider('test-key')
    const parsed = (provider as unknown as { _parseJSON: (s: string) => unknown })._parseJSON('invalid json {{')
    expect(parsed).toEqual({})
  })
})

// ============================================================
// Tests M24 — LLMProvider Factory
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetLLMProvider } from '@/lib/llm'

describe('M24 — getLLMProvider factory', () => {
  beforeEach(() => {
    resetLLMProvider()
    vi.resetModules()
  })

  it('retourne GeminiProvider quand LLM_PROVIDER=gemini', async () => {
    vi.stubEnv('VITE_LLM_PROVIDER', 'gemini')
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key-123')
    const { getLLMProvider } = await import('@/lib/llm')
    resetLLMProvider()
    const provider = getLLMProvider()
    expect(provider.name).toBe('gemini')
    expect(provider.model).toBe('gemini-1.5-flash')
  })

  it('retourne OllamaProvider quand LLM_PROVIDER=ollama', async () => {
    vi.stubEnv('VITE_LLM_PROVIDER', 'ollama')
    const { getLLMProvider, resetLLMProvider: reset } = await import('@/lib/llm')
    reset()
    const provider = getLLMProvider()
    expect(provider.name).toBe('ollama')
  })

  it('lève une erreur pour un provider inconnu', async () => {
    vi.stubEnv('VITE_LLM_PROVIDER', 'unknown-provider')
    const { getLLMProvider, resetLLMProvider: reset } = await import('@/lib/llm')
    reset()
    expect(() => getLLMProvider()).toThrow('non supporté')
  })

  it('retourne le même singleton à chaque appel', () => {
    vi.stubEnv('VITE_LLM_PROVIDER', 'gemini')
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key')
    const { getLLMProvider: get } = require('@/lib/llm')
    const p1 = get()
    const p2 = get()
    expect(p1).toBe(p2)
  })
})

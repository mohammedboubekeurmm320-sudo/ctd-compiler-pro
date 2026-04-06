// ============================================================
// M24 — Factory LLM Provider
// Switch via variable d'environnement LLM_PROVIDER
// Aucune modification de la logique métier lors du changement
// ============================================================

import type { LLMProvider } from './LLMProvider'
import { GeminiProvider } from './GeminiProvider'
import { OllamaProvider } from './OllamaProvider'

export type { LLMProvider }

let _instance: LLMProvider | null = null

/**
 * Retourne l'instance singleton du provider LLM configuré.
 * Provider sélectionné via import.meta.env.VITE_LLM_PROVIDER (frontend)
 * ou process.env.LLM_PROVIDER (Edge Functions).
 */
export function getLLMProvider(): LLMProvider {
  if (_instance) return _instance

  // Support frontend (Vite) et backend (Deno Edge Functions)
  const provider =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LLM_PROVIDER) ||
    (typeof process !== 'undefined' && process.env?.LLM_PROVIDER) ||
    'gemini'

  switch (provider.toLowerCase()) {
    case 'gemini': {
      const apiKey =
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
        (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
        ''
      _instance = new GeminiProvider(apiKey)
      break
    }

    case 'ollama': {
      const baseUrl =
        (typeof process !== 'undefined' && process.env?.OLLAMA_BASE_URL) ||
        'http://localhost:11434'
      const model =
        (typeof process !== 'undefined' && process.env?.OLLAMA_MODEL) ||
        'llama3.3'
      _instance = new OllamaProvider(baseUrl, model)
      break
    }

    default:
      throw new Error(`LLM provider non supporté : "${provider}". Utiliser "gemini" ou "ollama".`)
  }

  console.info(`[LLM] Provider actif : ${_instance.name} (${_instance.model})`)
  return _instance
}

/** Réinitialise le singleton — utilisé uniquement dans les tests */
export function resetLLMProvider(): void {
  _instance = null
}

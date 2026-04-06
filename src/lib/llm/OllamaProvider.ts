// ============================================================
// M24 — OllamaProvider — Stub Phase 2 (offline)
// Activé via LLM_PROVIDER=ollama dans .env
// ============================================================

import type { LLMProvider } from './LLMProvider'
import type {
  ExtractionResult,
  QualificationResult,
  DocCategory,
} from '@/types'

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama'
  readonly model: string

  private readonly baseUrl: string

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl || 'http://localhost:11434'
    this.model = model || 'llama3.3'
  }

  async extractFromDocument(
    content: string,
    ctdType: string,
    docCategory: DocCategory
  ): Promise<ExtractionResult> {
    const prompt = `Tu es un expert en dossiers réglementaires pharmaceutiques CTD ICH M4.
Type de CTD : ${ctdType} | Catégorie : ${docCategory}
Extrait les informations CTD du texte suivant en JSON :
{"extractions":[{"ctd_section":"...","field_key":"...","extracted_value":"...","confidence":0.9,"source_context":"..."}]}
Texte : ${content}`

    const raw = await this._callOllama(prompt)
    const parsed = this._parseJSON<{ extractions: ExtractionResult['extractions'] }>(raw)

    return {
      extractions: parsed.extractions ?? [],
      model: this.model,
    }
  }

  async qualifyDocument(
    fileName: string,
    textSample: string
  ): Promise<QualificationResult> {
    const prompt = `Catégorise ce document pharmaceutique.
Catégories : dmf | stability | coa | protocol | preclinical | csr | other
Fichier : ${fileName}
Extrait : ${textSample.substring(0, 1000)}
Réponds uniquement en JSON : {"category":"...","confidence":0.9,"reasoning":"..."}`

    const raw = await this._callOllama(prompt)
    const parsed = this._parseJSON<QualificationResult>(raw)

    return {
      category: parsed.category ?? 'other',
      confidence: parsed.confidence ?? 0,
      reasoning: parsed.reasoning ?? '',
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      return response.ok
    } catch {
      return false
    }
  }

  private async _callOllama(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: { temperature: 0.1 },
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API erreur ${response.status}`)
    }

    const data = await response.json() as { response: string }
    return data.response?.trim() ?? ''
  }

  private _parseJSON<T>(raw: string): Partial<T> {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
    try {
      return JSON.parse(cleaned) as T
    } catch {
      return {}
    }
  }
}

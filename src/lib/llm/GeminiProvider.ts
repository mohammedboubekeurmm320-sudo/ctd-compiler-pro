// ============================================================
// M24 — GeminiProvider — Gemini 1.5 Flash (MVP)
// ============================================================

import type { LLMProvider } from './LLMProvider'
import type {
  ExtractionResult,
  QualificationResult,
  DocCategory,
} from '@/types'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL = 'gemini-1.5-flash'

const EXTRACTION_SYSTEM_PROMPT = `Tu es un expert en dossiers réglementaires pharmaceutiques CTD ICH M4.
Analyse ce fragment de document et extrais toutes les informations pertinentes pour remplir un dossier CTD.
Retourne UNIQUEMENT un JSON valide avec la structure suivante, sans aucun texte avant ou après :
{
  "extractions": [
    {
      "ctd_section": "3.2.S.1.1",
      "field_key": "manufacturer_name",
      "extracted_value": "valeur extraite",
      "confidence": 0.95,
      "source_context": "phrase source dans le document"
    }
  ]
}
Si aucune information pertinente n'est trouvée, retourne {"extractions": []}.
Ne retourne rien d'autre que ce JSON.`

const QUALIFICATION_SYSTEM_PROMPT = `Tu es un expert en documentation pharmaceutique réglementaire.
Analyse le nom du fichier et l'extrait de texte fournis, puis détermine la catégorie du document.
Catégories possibles : dmf | stability | coa | protocol | preclinical | csr | other
Retourne UNIQUEMENT un JSON valide :
{
  "category": "dmf",
  "confidence": 0.92,
  "reasoning": "explication courte en français"
}
Ne retourne rien d'autre que ce JSON.`

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini'
  readonly model = MODEL

  private readonly apiKey: string

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('GeminiProvider: GEMINI_API_KEY manquante')
    }
    this.apiKey = apiKey
  }

  async extractFromDocument(
    content: string,
    ctdType: string,
    docCategory: DocCategory
  ): Promise<ExtractionResult> {
    const prompt = `${EXTRACTION_SYSTEM_PROMPT}

Type de CTD : ${ctdType}
Catégorie du document : ${docCategory}

Fragment de document à analyser :
---
${content}
---`

    const raw = await this._callGemini(prompt)
    const parsed = this._parseJSON<{ extractions: ExtractionResult['extractions'] }>(raw)

    return {
      extractions: parsed.extractions ?? [],
      model: MODEL,
    }
  }

  async qualifyDocument(
    fileName: string,
    textSample: string
  ): Promise<QualificationResult> {
    const prompt = `${QUALIFICATION_SYSTEM_PROMPT}

Nom du fichier : ${fileName}
Extrait de texte (500 premiers mots) :
---
${textSample.substring(0, 2000)}
---`

    const raw = await this._callGemini(prompt)
    const parsed = this._parseJSON<QualificationResult>(raw)

    return {
      category: parsed.category ?? 'other',
      confidence: parsed.confidence ?? 0,
      reasoning: parsed.reasoning ?? '',
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this._callGemini('Réponds uniquement "ok"')
      return true
    } catch {
      return false
    }
  }

  private async _callGemini(prompt: string, retries = 3): Promise<string> {
    const url = `${GEMINI_API_BASE}/models/${MODEL}:generateContent?key=${this.apiKey}`

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              topP: 0.8,
              maxOutputTokens: 8192,
            },
          }),
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Gemini API erreur ${response.status}: ${error}`)
        }

        const data = await response.json() as {
          candidates: Array<{
            content: { parts: Array<{ text: string }> }
          }>
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) throw new Error('Gemini API: réponse vide')

        return text.trim()
      } catch (error) {
        if (attempt === retries) throw error
        // Backoff exponentiel : 1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
      }
    }

    throw new Error('GeminiProvider: nombre maximum de tentatives atteint')
  }

  private _parseJSON<T>(raw: string): Partial<T> {
    // Nettoyer les éventuels backticks markdown
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    try {
      return JSON.parse(cleaned) as T
    } catch {
      console.error('GeminiProvider: impossible de parser le JSON', cleaned)
      return {}
    }
  }
}

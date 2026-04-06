// ============================================================
// M24 — LLMProvider Interface abstraite
// Jamais modifié après validation
// ============================================================

import type {
  ExtractionResult,
  QualificationResult,
  DocCategory,
} from '@/types'

export interface LLMProvider {
  readonly name: string
  readonly model: string

  /**
   * Extrait les données CTD d'un chunk de texte
   * @param content - Texte du document (chunk de 4000 tokens max)
   * @param ctdType - Type de CTD (M2/M3/M4/M5)
   * @param docCategory - Catégorie du document source
   * @returns ExtractionResult avec liste de champs extraits
   */
  extractFromDocument(
    content: string,
    ctdType: string,
    docCategory: DocCategory
  ): Promise<ExtractionResult>

  /**
   * Qualifie automatiquement un document selon sa catégorie CTD
   * @param fileName - Nom du fichier
   * @param textSample - 500 premiers mots du document
   * @returns QualificationResult avec catégorie et score de confiance
   */
  qualifyDocument(
    fileName: string,
    textSample: string
  ): Promise<QualificationResult>

  /**
   * Vérifie que le provider est opérationnel
   * @returns true si le provider répond correctement
   */
  healthCheck(): Promise<boolean>
}

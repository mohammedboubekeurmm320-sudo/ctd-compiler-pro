// ============================================================
// Tests M02 — getCTDProfile
// ============================================================

import { describe, it, expect } from 'vitest'
import { getCTDProfile, getSectionByCode, getRequiredSections } from '@/lib/ctd/sections'

describe('M02 — getCTDProfile', () => {
  it('M3 génère les sections CMC correctes', () => {
    const profile = getCTDProfile('M3', 'EMA')
    const codes = profile.sections.map(s => s.code)
    expect(codes).toContain('3.2.S.1')
    expect(codes).toContain('3.2.S.7')
    expect(codes).toContain('3.2.P.1')
    expect(codes).toContain('3.2.P.8')
  })

  it('M4 génère les sections précliniques', () => {
    const profile = getCTDProfile('M4', 'FDA')
    const codes = profile.sections.map(s => s.code)
    expect(codes).toContain('4.2.1')
    expect(codes).toContain('4.2.2')
    expect(codes).toContain('4.2.3')
  })

  it('M5 génère les sections cliniques', () => {
    const profile = getCTDProfile('M5', 'EMA')
    const codes = profile.sections.map(s => s.code)
    expect(codes).toContain('5.3.1')
    expect(codes).toContain('5.3.3')
    expect(codes).toContain('5.3.5')
  })

  it('M2 génère les sections résumés', () => {
    const profile = getCTDProfile('M2', 'ANSM')
    const codes = profile.sections.map(s => s.code)
    expect(codes).toContain('2.3')
    expect(codes).toContain('2.5')
  })

  it('FDA M3 ajoute le champ validation spécifique', () => {
    const profile = getCTDProfile('M3', 'FDA')
    const s4 = getSectionByCode(profile, '3.2.S.4')
    const fdaField = s4?.fields.find(f => f.key === 'fda_validation_summary')
    expect(fdaField).toBeDefined()
    expect(fdaField?.required).toBe(true)
  })

  it('toutes les sections obligatoires M3 ont au moins un champ requis', () => {
    const profile = getCTDProfile('M3', 'EMA')
    const required = getRequiredSections(profile)
    required.forEach(section => {
      const hasRequiredField = section.fields.some(f => f.required)
      expect(hasRequiredField, `Section ${section.code} doit avoir des champs requis`).toBe(true)
    })
  })

  it('getSectionByCode retourne la bonne section', () => {
    const profile = getCTDProfile('M3', 'EMA')
    const section = getSectionByCode(profile, '3.2.S.7')
    expect(section).toBeDefined()
    expect(section?.title).toBe('Stability')
  })

  it('getSectionByCode retourne undefined pour code inexistant', () => {
    const profile = getCTDProfile('M3', 'EMA')
    const section = getSectionByCode(profile, '9.9.Z.0')
    expect(section).toBeUndefined()
  })
})

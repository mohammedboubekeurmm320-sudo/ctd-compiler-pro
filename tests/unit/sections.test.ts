// ============================================================
// Tests M02 — CTD Sections mapping
// ============================================================

import { describe, it, expect } from 'vitest'
import { getCTDProfile, getSectionByCode, getRequiredSections } from '@/lib/ctd/sections'

describe('M02 — getCTDProfile', () => {
  it('retourne les sections M3 EMA correctement', () => {
    const profile = getCTDProfile('M3', 'EMA')
    expect(profile.sections.length).toBeGreaterThan(0)
    expect(profile.sections.some(s => s.code === '3.2.S.1')).toBe(true)
    expect(profile.sections.some(s => s.code === '3.2.P.8')).toBe(true)
  })

  it('retourne les sections M4 correctement', () => {
    const profile = getCTDProfile('M4', 'EMA')
    expect(profile.sections.some(s => s.code === '4.2.3')).toBe(true)
    expect(profile.sections.some(s => s.code.startsWith('3.'))).toBe(false)
  })

  it('retourne les sections M5 correctement', () => {
    const profile = getCTDProfile('M5', 'FDA')
    expect(profile.sections.some(s => s.code === '5.3.5')).toBe(true)
  })

  it('ajoute le champ FDA spécifique pour M3 FDA', () => {
    const profile = getCTDProfile('M3', 'FDA')
    const s4 = profile.sections.find(s => s.code === '3.2.S.4')
    expect(s4?.fields.some(f => f.key === 'fda_validation_summary')).toBe(true)
  })

  it('ne contient pas le champ FDA pour M3 EMA', () => {
    const profile = getCTDProfile('M3', 'EMA')
    const s4 = profile.sections.find(s => s.code === '3.2.S.4')
    expect(s4?.fields.some(f => f.key === 'fda_validation_summary')).toBe(false)
  })

  it('chaque section a au moins un champ', () => {
    const profile = getCTDProfile('M3', 'EMA')
    profile.sections.forEach(s => {
      expect(s.fields.length).toBeGreaterThan(0)
    })
  })
})

describe('M02 — getSectionByCode', () => {
  it('retourne la section si elle existe', () => {
    const profile = getCTDProfile('M3', 'EMA')
    const section = getSectionByCode(profile, '3.2.S.1')
    expect(section).toBeDefined()
    expect(section?.title).toBe('General Information')
  })

  it('retourne undefined si section inconnue', () => {
    const profile = getCTDProfile('M3', 'EMA')
    expect(getSectionByCode(profile, '9.9.X')).toBeUndefined()
  })
})

describe('M02 — getRequiredSections', () => {
  it('retourne uniquement les sections obligatoires', () => {
    const profile = getCTDProfile('M3', 'EMA')
    const required = getRequiredSections(profile)
    expect(required.every(s => s.required)).toBe(true)
    expect(required.length).toBeGreaterThan(0)
  })
})

// ============================================================
// M02 — Mapping type CTD + autorité → profil de sections
// Source de vérité pour toute la structure CTD
// ============================================================

import type { CTDType, RegulatoryAuthority, CTDProfile, CTDSection, CTDField } from '@/types'

// ─── Champs communs réutilisables ──────────────────────────
const textField = (key: string, label: string, required = true, hint?: string): CTDField => ({
  key, label, type: 'text', required, ich_reference: hint,
})
const textareaField = (key: string, label: string, required = true): CTDField => ({
  key, label, type: 'textarea', required,
})
const dateField = (key: string, label: string, required = true): CTDField => ({
  key, label, type: 'date', required,
})
const numberField = (key: string, label: string, unit?: string, required = true): CTDField => ({
  key, label, type: 'number', required, unit,
})

// ─── Sections Module 3 (CMC) ──────────────────────────────
const M3_SECTIONS: CTDSection[] = [
  {
    code: '3.2.S.1',
    title: 'General Information',
    required: true,
    fields: [
      textField('drug_substance_name', 'Nom de la substance active (DCI)'),
      textField('manufacturer_name', 'Nom du fabricant'),
      textField('manufacturer_address', 'Adresse du fabricant'),
      textField('inn_name', 'Dénomination commune internationale'),
      textField('cas_number', 'Numéro CAS', false),
      textField('molecular_formula', 'Formule moléculaire'),
      numberField('molecular_weight', 'Masse moléculaire', 'g/mol'),
    ],
  },
  {
    code: '3.2.S.2',
    title: 'Manufacture',
    required: true,
    fields: [
      textField('manufacturing_site', 'Site de fabrication'),
      textareaField('manufacturing_process', 'Description du procédé de fabrication'),
      textareaField('process_controls', 'Contrôles en cours de fabrication'),
      textField('batch_size', 'Taille de lot'),
    ],
  },
  {
    code: '3.2.S.3',
    title: 'Characterisation',
    required: true,
    fields: [
      textareaField('structure_elucidation', 'Élucidation de la structure'),
      textareaField('physicochemical_properties', 'Propriétés physico-chimiques'),
      textField('optical_activity', 'Activité optique', false),
    ],
  },
  {
    code: '3.2.S.4',
    title: 'Control of Drug Substance',
    required: true,
    fields: [
      textareaField('specifications', 'Spécifications de la substance active'),
      textareaField('analytical_procedures', 'Méthodes analytiques'),
      textareaField('validation_procedures', 'Validation des méthodes (ICH Q2R1)'),
      textareaField('batch_analyses', 'Analyses de lots'),
    ],
  },
  {
    code: '3.2.S.5',
    title: 'Reference Standards or Materials',
    required: true,
    fields: [
      textField('reference_standard_source', 'Source des étalons de référence'),
      textField('reference_standard_lot', 'Numéro de lot de l\'étalon'),
      textareaField('reference_standard_characterization', 'Caractérisation de l\'étalon'),
    ],
  },
  {
    code: '3.2.S.6',
    title: 'Container Closure System',
    required: true,
    fields: [
      textField('container_type', 'Type de contenant'),
      textField('container_material', 'Matériau du contenant'),
      textareaField('container_specifications', 'Spécifications du contenant'),
    ],
  },
  {
    code: '3.2.S.7',
    title: 'Stability',
    required: true,
    fields: [
      textareaField('stability_summary', 'Résumé des études de stabilité'),
      textField('shelf_life', 'Durée de conservation proposée'),
      textField('storage_conditions', 'Conditions de stockage recommandées'),
      textField('ich_conditions_25', 'Résultats 25°C/60%HR (ICH Q1A)', false),
      textField('ich_conditions_40', 'Résultats 40°C/75%HR (ICH Q1A accéléré)', false),
      dateField('stability_start_date', 'Date de début des études'),
    ],
  },
  {
    code: '3.2.P.1',
    title: 'Description and Composition of the Drug Product',
    required: true,
    fields: [
      textField('product_description', 'Description du produit fini'),
      textField('dosage_form', 'Forme pharmaceutique'),
      textField('route_of_administration', 'Voie d\'administration'),
      textareaField('composition', 'Composition qualitative et quantitative'),
    ],
  },
  {
    code: '3.2.P.2',
    title: 'Pharmaceutical Development',
    required: true,
    fields: [
      textareaField('formulation_development', 'Développement de la formulation'),
      textareaField('overages', 'Excédents de formulation', false),
      textareaField('excipient_choice', 'Choix des excipients'),
    ],
  },
  {
    code: '3.2.P.3',
    title: 'Manufacture',
    required: true,
    fields: [
      textField('product_manufacturer', 'Fabricant du produit fini'),
      textareaField('product_manufacturing_process', 'Procédé de fabrication'),
      textField('product_batch_size', 'Taille de lot'),
    ],
  },
  {
    code: '3.2.P.4',
    title: 'Control of Excipients',
    required: true,
    fields: [
      textareaField('excipient_specifications', 'Spécifications des excipients'),
      textField('excipient_sources', 'Sources des excipients'),
    ],
  },
  {
    code: '3.2.P.5',
    title: 'Control of Drug Product',
    required: true,
    fields: [
      textareaField('product_specifications', 'Spécifications du produit fini'),
      textareaField('product_analytical_procedures', 'Méthodes analytiques produit'),
      textareaField('product_batch_analyses', 'Analyses de lots produit'),
    ],
  },
  {
    code: '3.2.P.7',
    title: 'Container Closure System',
    required: true,
    fields: [
      textField('product_container_type', 'Type de conditionnement primaire'),
      textField('product_container_material', 'Matériau du conditionnement'),
    ],
  },
  {
    code: '3.2.P.8',
    title: 'Stability',
    required: true,
    fields: [
      textareaField('product_stability_summary', 'Résumé stabilité produit fini'),
      textField('product_shelf_life', 'Durée de vie du produit fini'),
      textField('product_storage_conditions', 'Conditions de stockage produit'),
    ],
  },
]

// ─── Sections Module 4 (Préclinique) ──────────────────────
const M4_SECTIONS: CTDSection[] = [
  {
    code: '4.2.1',
    title: 'Pharmacology',
    required: true,
    fields: [
      textareaField('primary_pharmacodynamics', 'Pharmacodynamie primaire'),
      textareaField('secondary_pharmacodynamics', 'Pharmacodynamie secondaire', false),
      textareaField('safety_pharmacology', 'Pharmacologie de sécurité'),
      textareaField('pharmacodynamic_interactions', 'Interactions pharmacodynamiques', false),
    ],
  },
  {
    code: '4.2.2',
    title: 'Pharmacokinetics',
    required: true,
    fields: [
      textareaField('absorption', 'Absorption'),
      textareaField('distribution', 'Distribution'),
      textareaField('metabolism', 'Métabolisme'),
      textareaField('excretion', 'Excrétion'),
      textField('bioavailability', 'Biodisponibilité (%)', false),
    ],
  },
  {
    code: '4.2.3',
    title: 'Toxicology',
    required: true,
    fields: [
      textField('single_dose_toxicity_species', 'Espèces utilisées — toxicité dose unique'),
      textField('single_dose_toxicity_route', 'Voie d\'administration — dose unique'),
      textField('noael', 'NOAEL — dose sans effet néfaste observé'),
      textareaField('repeat_dose_toxicity', 'Toxicité à doses répétées'),
      textareaField('genotoxicity', 'Génotoxicité'),
      textareaField('carcinogenicity', 'Cancérogénicité', false),
      textareaField('reproductive_toxicity', 'Toxicité pour la reproduction', false),
    ],
  },
]

// ─── Sections Module 5 (Clinique) ─────────────────────────
const M5_SECTIONS: CTDSection[] = [
  {
    code: '5.3.1',
    title: 'Reports of Biopharmaceutic Studies',
    required: true,
    fields: [
      textareaField('bioavailability_studies', 'Études de biodisponibilité'),
      textareaField('bioequivalence_studies', 'Études de bioéquivalence', false),
    ],
  },
  {
    code: '5.3.3',
    title: 'Reports of Human PK Studies',
    required: true,
    fields: [
      textField('pk_population', 'Population étudiée'),
      textField('pk_dose_range', 'Plage de doses'),
      textField('pk_cmax', 'Cmax', 'ng/mL', false),
      textField('pk_tmax', 'Tmax', 'h', false),
      textField('pk_auc', 'AUC', 'ng·h/mL', false),
      textField('pk_t12', 'Demi-vie (t½)', 'h', false),
    ],
  },
  {
    code: '5.3.5',
    title: 'Reports of Efficacy and Safety Studies',
    required: true,
    fields: [
      textField('study_type', 'Type d\'étude (Phase I/II/III)'),
      textField('study_design', 'Design de l\'étude'),
      textField('study_population_size', 'Taille de la population'),
      textField('primary_endpoint', 'Critère d\'évaluation principal'),
      textareaField('efficacy_results', 'Résultats d\'efficacité'),
      textareaField('safety_results', 'Résultats de sécurité / effets indésirables'),
    ],
  },
  {
    code: '5.3.6',
    title: 'Reports of Post-Marketing Experience',
    required: false,
    fields: [
      textareaField('post_marketing_experience', 'Expérience post-commercialisation', false),
    ],
  },
]

// ─── Sections Module 2 (Résumés) ──────────────────────────
const M2_SECTIONS: CTDSection[] = [
  {
    code: '2.3',
    title: 'Quality Overall Summary',
    required: true,
    fields: [
      textareaField('quality_summary', 'Résumé global de la qualité (CMC)'),
      textareaField('drug_substance_summary', 'Résumé substance active'),
      textareaField('drug_product_summary', 'Résumé produit fini'),
    ],
  },
  {
    code: '2.4',
    title: 'Nonclinical Overview',
    required: true,
    fields: [
      textareaField('nonclinical_overview', 'Vue d\'ensemble préclinique'),
    ],
  },
  {
    code: '2.5',
    title: 'Clinical Overview',
    required: true,
    fields: [
      textareaField('clinical_overview', 'Vue d\'ensemble clinique'),
      textareaField('benefit_risk_summary', 'Résumé bénéfice/risque'),
    ],
  },
]

// ─── Factory principale ────────────────────────────────────
export function getCTDProfile(
  ctdType: CTDType,
  authority: RegulatoryAuthority
): CTDProfile {
  let sections: CTDSection[]

  switch (ctdType) {
    case 'M2': sections = M2_SECTIONS; break
    case 'M3': sections = M3_SECTIONS; break
    case 'M4': sections = M4_SECTIONS; break
    case 'M5': sections = M5_SECTIONS; break
    default:   sections = M3_SECTIONS
  }

  // Ajustements spécifiques par autorité
  if (authority === 'FDA' && ctdType === 'M3') {
    // FDA : section 3.2.S.4.3 validation analytique plus stricte
    sections = sections.map(s => s.code === '3.2.S.4' ? {
      ...s,
      fields: [
        ...s.fields,
        textareaField('fda_validation_summary', 'Résumé validation FDA (21 CFR 211.165)', true),
      ],
    } : s)
  }

  return { sections }
}

export function getSectionByCode(profile: CTDProfile, code: string): CTDSection | undefined {
  return profile.sections.find(s => s.code === code)
}

export function getRequiredSections(profile: CTDProfile): CTDSection[] {
  return profile.sections.filter(s => s.required)
}

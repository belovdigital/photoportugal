/**
 * Display names for the region badge on location cards.
 *
 * The `region` field in the locations datasets is a single English string, and
 * it is rendered as-is in every locale. On Portugal that is barely noticeable
 * ("Alentejo" and "Algarve" are the same word everywhere), but Spain's regions
 * genuinely differ — a Spanish visitor was reading "Catalonia" and "Basque
 * Country" on the Spanish site.
 *
 * Only the Spanish regions are listed. Anything absent falls through unchanged,
 * so Portugal's badges are byte-identical to before by construction rather than
 * by my having checked each one — localizing Portugal's regions too would be a
 * separate, deliberate decision, not a side effect of fixing Spain.
 *
 * Keep this in step with `location-explorer-data-es.ts`, whose `names` field
 * localizes the same regions in the map explorer. The two appear side by side
 * on /locations, and one translated while the other is not reads worse than
 * neither being translated.
 */
const REGION_LABELS: Record<string, Record<string, string>> = {
  Catalonia: { es: "Cataluña", de: "Katalonien", fr: "Catalogne", pt: "Catalunha" },
  "Community of Madrid": {
    es: "Comunidad de Madrid",
    de: "Region Madrid",
    fr: "Communauté de Madrid",
    pt: "Comunidade de Madrid",
  },
  Andalusia: { es: "Andalucía", de: "Andalusien", fr: "Andalousie", pt: "Andaluzia" },
  "Balearic Islands": {
    es: "Islas Baleares",
    de: "Balearen",
    fr: "Îles Baléares",
    pt: "Ilhas Baleares",
  },
  "Canary Islands": {
    es: "Islas Canarias",
    de: "Kanarische Inseln",
    fr: "Îles Canaries",
    pt: "Ilhas Canárias",
  },
  "Valencian Community": {
    es: "Comunidad Valenciana",
    de: "Region Valencia",
    fr: "Communauté valencienne",
    pt: "Comunidade Valenciana",
  },
  "Basque Country": { es: "País Vasco", de: "Baskenland", fr: "Pays basque", pt: "País Basco" },
  Galicia: { de: "Galicien", fr: "Galice", pt: "Galiza" },
};

export function regionLabel(region: string, locale?: string): string {
  if (!region || !locale) return region;
  return REGION_LABELS[region]?.[locale] ?? region;
}

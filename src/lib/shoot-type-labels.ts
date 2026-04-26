// Canonical shoot type → localized label.
// Photographer profiles store shoot_types as the canonical English values
// from SHOOT_TYPES; this maps them to display labels per locale.

const LABELS: Record<string, Record<string, string>> = {
  en: {
    Couples: "Couples",
    Family: "Family",
    "Solo Portrait": "Solo Portrait",
    Engagement: "Engagement",
    Proposal: "Proposal",
    Honeymoon: "Honeymoon",
    Wedding: "Wedding",
    Maternity: "Maternity",
    "Friends Trip": "Friends Trip",
    Anniversary: "Anniversary",
    Elopement: "Elopement",
    Birthday: "Birthday",
    "Kids Birthday": "Kids Birthday",
    "Studio Portrait": "Studio Portrait",
    "Content Creator": "Content Creator",
  },
  pt: {
    Couples: "Casais",
    Family: "Família",
    "Solo Portrait": "Retrato Individual",
    Engagement: "Noivado",
    Proposal: "Pedido de Casamento",
    Honeymoon: "Lua de Mel",
    Wedding: "Casamento",
    Maternity: "Gravidez",
    "Friends Trip": "Viagem de Amigos",
    Anniversary: "Aniversário",
    Elopement: "Elopement",
    Birthday: "Aniversário",
    "Kids Birthday": "Festa de Aniversário Infantil",
    "Studio Portrait": "Retrato em Estúdio",
    "Content Creator": "Criador de Conteúdo",
  },
  de: {
    Couples: "Paare",
    Family: "Familie",
    "Solo Portrait": "Solo-Porträt",
    Engagement: "Verlobung",
    Proposal: "Heiratsantrag",
    Honeymoon: "Flitterwochen",
    Wedding: "Hochzeit",
    Maternity: "Schwangerschaft",
    "Friends Trip": "Freundes-Reise",
    Anniversary: "Jubiläum",
    Elopement: "Elopement",
    Birthday: "Geburtstag",
    "Kids Birthday": "Kindergeburtstag",
    "Studio Portrait": "Studio-Porträt",
    "Content Creator": "Content Creator",
  },
  es: {
    Couples: "Parejas",
    Family: "Familia",
    "Solo Portrait": "Retrato individual",
    Engagement: "Compromiso",
    Proposal: "Pedida de mano",
    Honeymoon: "Luna de miel",
    Wedding: "Boda",
    Maternity: "Embarazo",
    "Friends Trip": "Viaje de amigos",
    Anniversary: "Aniversario",
    Elopement: "Boda íntima",
    Birthday: "Cumpleaños",
    "Kids Birthday": "Cumpleaños infantil",
    "Studio Portrait": "Retrato en estudio",
    "Content Creator": "Creador de contenido",
  },
  fr: {
    Couples: "Couples",
    Family: "Famille",
    "Solo Portrait": "Portrait solo",
    Engagement: "Fiançailles",
    Proposal: "Demande en mariage",
    Honeymoon: "Lune de miel",
    Wedding: "Mariage",
    Maternity: "Grossesse",
    "Friends Trip": "Voyage entre amis",
    Anniversary: "Anniversaire",
    Elopement: "Elopement",
    Birthday: "Anniversaire",
    "Kids Birthday": "Anniversaire enfant",
    "Studio Portrait": "Portrait en studio",
    "Content Creator": "Créateur de contenu",
  },
};

export function localizeShootType(canonical: string, locale: string): string {
  const dict = LABELS[locale] || LABELS.en;
  return dict[canonical] || canonical;
}

// Localize an array of canonical shoot types for the active locale.
export function localizeShootTypes(types: string[], locale: string): string[] {
  return types.map((t) => localizeShootType(t, locale));
}

// Canonical shoot type → localized label.
// Photographer profiles store shoot_types as the canonical English values
// from SHOOT_TYPES; this maps them to display labels per locale.

import { SHOOT_TYPES } from "@/types";

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
    Fashion: "Fashion",
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
    Fashion: "Moda",
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
    Fashion: "Mode",
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
    Fashion: "Moda",
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
    Fashion: "Mode",
  },
};

// ─── Canonicalization ──────────────────────────────────────────────────
// Photographers historically tagged photos with BOTH slugs ("wedding",
// "solo", "content-creator") and canonical names ("Wedding", "Solo
// Portrait"), so a single portfolio showed duplicate filter pills (e.g.
// "Wedding" AND "wedding", "Solo Portrait" AND "solo"). This maps any
// stored variant back to its one canonical SHOOT_TYPES value. Used at the
// write boundary (new tags are always canonical) and in the portfolio
// gallery (legacy rows dedupe in the UI).
const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();

const CANONICAL_BY_NORM: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const c of SHOOT_TYPES) m[norm(c)] = c;
  // Slug aliases that don't normalize onto a canonical name on their own.
  m["solo"] = "Solo Portrait";
  m["friends"] = "Friends Trip";
  return m;
})();

/** Map any stored shoot_type variant (slug, wrong-case, canonical) to its
 *  canonical SHOOT_TYPES value. Unknown values are returned trimmed but
 *  otherwise untouched so nothing is silently dropped. */
export function canonicalizeShootType(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return CANONICAL_BY_NORM[norm(trimmed)] || trimmed;
}

export function localizeShootType(canonical: string, locale: string): string {
  const dict = LABELS[locale] || LABELS.en;
  return dict[canonical] || dict[canonicalizeShootType(canonical) || canonical] || canonical;
}

// Localize an array of canonical shoot types for the active locale.
export function localizeShootTypes(types: string[], locale: string): string[] {
  return types.map((t) => localizeShootType(t, locale));
}

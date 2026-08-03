// Which of a photographer's cities to name when there is only room for two
// or three of them.
//
// Sorting the slugs alphabetically — the obvious thing, and what several
// queries still do inline — surfaces satellites over anchors: a Lisbon
// photographer reads as "Almada · Arrábida · Caparica" and a Porto one loses
// Porto entirely. Neither is wrong, both are useless to a visitor scanning a
// list. The catalog's own array order doesn't help either: it groups by
// region, so Sitges lands ahead of Madrid.
//
// So: an explicit anchor list per market, ordered by search demand and by how
// recognisable the name is to someone who has never been. Anything not on the
// list keeps its relative order after the anchors, alphabetically, so the
// result stays deterministic.
import { country } from "@/lib/country";
import { locations, locField } from "@/lib/locations-data";

const ANCHORS_PT = [
  "lisbon", "porto", "sintra", "cascais", "algarve", "madeira", "azores",
  "douro-valley", "lagos", "comporta", "evora", "aveiro", "braga", "guimaraes",
  "coimbra", "nazare", "obidos", "tavira", "funchal", "ponta-delgada",
];

const ANCHORS_ES = [
  "barcelona", "madrid", "seville", "valencia", "granada", "mallorca", "ibiza",
  "malaga", "san-sebastian", "bilbao", "tenerife", "marbella", "toledo",
  "cordoba", "santiago-de-compostela", "girona", "costa-brava", "segovia",
];

const ANCHORS = country.code === "es" ? ANCHORS_ES : ANCHORS_PT;

/** Lower is more prominent. Non-anchor slugs all share one rank and then
 *  settle alphabetically. */
export function locationRank(slug: string): number {
  const i = ANCHORS.indexOf(slug);
  return i === -1 ? ANCHORS.length : i;
}

/** The N cities worth naming, most prominent first. */
export function topLocationSlugs(slugs: string[], limit = 3): string[] {
  return [...slugs]
    .sort((a, b) => locationRank(a) - locationRank(b) || a.localeCompare(b))
    .slice(0, limit);
}

/**
 * Card-ready city line: ranked, trimmed and in the visitor's language.
 *
 * Takes the comma-separated slugs the card queries select. Those queries used
 * to build the string in SQL with
 * `string_agg(INITCAP(REPLACE(location_slug, '-', ' ')), ', ' ORDER BY location_slug) ... LIMIT 3`,
 * which had three faults at once: the LIMIT applied to the outer single-row
 * select and capped nothing (a photographer covering eleven places listed all
 * eleven), the alphabetical order buried the anchor city under its satellites,
 * and INITCAP on a slug spells Évora "Evora" in every language.
 */
export function formatLocationList(
  value: string | string[] | null | undefined,
  locale: string,
  limit = 3,
): string {
  const slugs = (typeof value === "string" ? value.split(",") : value || [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (slugs.length === 0) return "";
  return topLocationSlugs(slugs, limit)
    .map((slug) => {
      const loc = locations.find((l) => l.slug === slug);
      return loc ? locField(loc, "name", locale) || loc.name : slug;
    })
    .join(", ");
}

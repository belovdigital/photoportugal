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

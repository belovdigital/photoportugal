import { LOCATION_TREE_ES } from "./location-hierarchy-es";
import { LOCATION_TREE_IT } from "./location-hierarchy-it";
import { locations } from "@/lib/locations-data";

export type LocationNodeType = "region" | "group" | "island" | "city" | "spot";

export type LocationNode = {
  slug: string;
  name: string;
  type: LocationNodeType;
  children?: LocationNode[];
  legacySlugs?: string[];
};

const legacyLocationSlugs = new Set(locations.map((location) => location.slug));

function legacy(slug: string): string[] {
  return legacyLocationSlugs.has(slug) ? [slug] : [];
}

const LOCATION_TREEPT: LocationNode[] = [
  {
    slug: "lisbon-region",
    name: "Lisbon Region",
    type: "region",
    children: [
      { slug: "lisbon", name: "Lisbon", type: "city", legacySlugs: legacy("lisbon") },
      { slug: "sintra", name: "Sintra", type: "city", legacySlugs: legacy("sintra") },
      { slug: "cascais", name: "Cascais", type: "city", legacySlugs: legacy("cascais") },
      { slug: "ericeira", name: "Ericeira", type: "city", legacySlugs: legacy("ericeira") },
      { slug: "caparica", name: "Costa da Caparica", type: "city", legacySlugs: legacy("caparica") },
      { slug: "almada", name: "Almada", type: "city", legacySlugs: legacy("almada") },
      { slug: "setubal", name: "Setubal", type: "city", legacySlugs: legacy("setubal") },
      { slug: "sesimbra", name: "Sesimbra", type: "city", legacySlugs: legacy("sesimbra") },
      { slug: "arrabida", name: "Arrabida", type: "spot", legacySlugs: legacy("arrabida") },
      { slug: "comporta", name: "Comporta", type: "city", legacySlugs: legacy("comporta") },
    ],
  },
  {
    slug: "porto-north",
    name: "Porto & North",
    type: "region",
    children: [
      { slug: "porto", name: "Porto", type: "city", legacySlugs: legacy("porto") },
      { slug: "douro-valley", name: "Douro Valley", type: "region", legacySlugs: legacy("douro-valley") },
      { slug: "braga", name: "Braga", type: "city", legacySlugs: legacy("braga") },
      { slug: "guimaraes", name: "Guimaraes", type: "city", legacySlugs: legacy("guimaraes") },
      { slug: "geres", name: "Geres", type: "region", legacySlugs: legacy("geres") },
    ],
  },
  {
    slug: "central-portugal",
    name: "Central Portugal",
    type: "region",
    children: [
      { slug: "aveiro", name: "Aveiro", type: "city", legacySlugs: legacy("aveiro") },
      { slug: "coimbra", name: "Coimbra", type: "city", legacySlugs: legacy("coimbra") },
      { slug: "peniche", name: "Peniche", type: "city", legacySlugs: legacy("peniche") },
      { slug: "nazare", name: "Nazare", type: "city", legacySlugs: legacy("nazare") },
      { slug: "obidos", name: "Obidos", type: "city", legacySlugs: legacy("obidos") },
      { slug: "tomar", name: "Tomar", type: "city", legacySlugs: legacy("tomar") },
      { slug: "leiria", name: "Leiria", type: "city", legacySlugs: legacy("leiria") },
    ],
  },
  {
    slug: "alentejo",
    name: "Alentejo",
    type: "region",
    children: [
      { slug: "evora", name: "Evora", type: "city", legacySlugs: legacy("evora") },
    ],
  },
  {
    slug: "algarve",
    name: "Algarve",
    type: "region",
    legacySlugs: legacy("algarve"),
    children: [
      { slug: "lagos", name: "Lagos", type: "city", legacySlugs: legacy("lagos") },
      { slug: "albufeira", name: "Albufeira", type: "city", legacySlugs: legacy("albufeira") },
      { slug: "faro", name: "Faro", type: "city", legacySlugs: legacy("faro") },
      { slug: "tavira", name: "Tavira", type: "city", legacySlugs: legacy("tavira") },
      { slug: "portimao", name: "Portimao", type: "city", legacySlugs: legacy("portimao") },
      { slug: "vilamoura", name: "Vilamoura", type: "city", legacySlugs: legacy("vilamoura") },
    ],
  },
  {
    slug: "madeira",
    name: "Madeira",
    type: "region",
    legacySlugs: legacy("madeira"),
    children: [
      { slug: "funchal", name: "Funchal", type: "city", legacySlugs: legacy("funchal") },
    ],
  },
  {
    slug: "azores",
    name: "Azores",
    type: "region",
    legacySlugs: legacy("azores"),
    children: [
      {
        slug: "azores-eastern-group",
        name: "Eastern Group",
        type: "group",
        legacySlugs: legacy("azores"),
        children: [
          {
            slug: "sao-miguel",
            name: "Sao Miguel",
            type: "island",
            legacySlugs: ["azores", ...legacy("ponta-delgada")],
            children: [
              { slug: "ponta-delgada", name: "Ponta Delgada", type: "city", legacySlugs: legacy("ponta-delgada") },
            ],
          },
          { slug: "santa-maria", name: "Santa Maria", type: "island", legacySlugs: legacy("azores") },
        ],
      },
      {
        slug: "azores-central-group",
        name: "Central Group",
        type: "group",
        legacySlugs: legacy("azores"),
        children: [
          { slug: "terceira", name: "Terceira", type: "island", legacySlugs: legacy("azores") },
          { slug: "graciosa", name: "Graciosa", type: "island", legacySlugs: legacy("azores") },
          { slug: "sao-jorge", name: "Sao Jorge", type: "island", legacySlugs: legacy("azores") },
          { slug: "pico", name: "Pico", type: "island", legacySlugs: legacy("azores") },
          { slug: "faial", name: "Faial", type: "island", legacySlugs: legacy("azores") },
        ],
      },
      {
        slug: "azores-western-group",
        name: "Western Group",
        type: "group",
        legacySlugs: legacy("azores"),
        children: [
          { slug: "flores", name: "Flores", type: "island", legacySlugs: legacy("azores") },
          { slug: "corvo", name: "Corvo", type: "island", legacySlugs: legacy("azores") },
        ],
      },
    ],
  },
];

/**
 * Country pack switch. NEXT_PUBLIC_ prefix is required — this module reaches
 * client components, and a server-only variable reads as undefined in the
 * browser bundle, silently falling back to Portugal. See docs/SPAIN.md §6.4.
 *
 * Portugal stays the default: absent or unrecognised value → the PT dataset.
 */
export const LOCATION_TREE: LocationNode[] =
  process.env.NEXT_PUBLIC_COUNTRY === "es"
    ? LOCATION_TREE_ES
    : process.env.NEXT_PUBLIC_COUNTRY === "it"
      ? LOCATION_TREE_IT
      : LOCATION_TREEPT;


export function flattenLocationNodes(nodes: LocationNode[] = LOCATION_TREE): LocationNode[] {
  return nodes.flatMap((node) => [node, ...flattenLocationNodes(node.children || [])]);
}

const allNodes = flattenLocationNodes();
const nodeBySlug = new Map(allNodes.map((node) => [node.slug, node]));

export function getLocationNode(slug: string): LocationNode | undefined {
  return nodeBySlug.get(slug);
}

export function getLocationDisplayName(slug: string): string {
  const node = nodeBySlug.get(slug);
  if (node) return node.name;
  const location = locations.find((loc) => loc.slug === slug);
  if (location) return location.name;
  return slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isKnownLocationSlug(slug: string): boolean {
  return nodeBySlug.has(slug) || legacyLocationSlugs.has(slug);
}

export function getDescendantNodeSlugs(node: LocationNode): string[] {
  return (node.children || []).flatMap((child) => [child.slug, ...getDescendantNodeSlugs(child)]);
}

export function getAncestorNodeSlugs(slug: string, nodes: LocationNode[] = LOCATION_TREE, ancestors: string[] = []): string[] {
  for (const node of nodes) {
    if (node.slug === slug) return ancestors;
    const found = getAncestorNodeSlugs(slug, node.children || [], [...ancestors, node.slug]);
    if (found.length > 0) return found;
  }
  return [];
}

function collectLegacySlugs(node: LocationNode): string[] {
  return [
    ...(node.legacySlugs || []),
    ...(node.children || []).flatMap(collectLegacySlugs),
  ];
}

export function normalizeCoverageNodeSlugs(slugs: string[]): string[] {
  return Array.from(new Set(slugs.filter((slug) => nodeBySlug.has(slug))));
}

function collapseNode(node: LocationNode, selected: Set<string>): { covered: boolean; slugs: string[] } {
  if (selected.has(node.slug)) return { covered: true, slugs: [node.slug] };
  const children = node.children || [];
  if (children.length === 0) return { covered: false, slugs: [] };
  const results = children.map((child) => collapseNode(child, selected));
  if (results.every((r) => r.covered)) return { covered: true, slugs: [node.slug] };
  return { covered: false, slugs: results.flatMap((r) => r.slugs) };
}

/** Replace a complete set of children with the parent node itself.
 *  The picker already DISPLAYS a region as fully checked once every city
 *  under it is ticked, but without this the stored selection stays a list of
 *  cities and the region's own slug is never written — and that slug is what
 *  the region's location page and the concierge's exact-coverage match key on.
 *  Partial selections are left untouched. */
export function collapseCoverageToParents(slugs: string[]): string[] {
  const selected = new Set(normalizeCoverageNodeSlugs(slugs));
  if (selected.size === 0) return [];
  return Array.from(new Set(LOCATION_TREE.flatMap((node) => collapseNode(node, selected).slugs)));
}

export function expandLocationCoverageToLegacySlugs(slugs: string[]): string[] {
  const legacySlugs = slugs.flatMap((slug) => {
    const node = nodeBySlug.get(slug);
    return node ? collectLegacySlugs(node) : legacy(slug);
  });
  return Array.from(new Set(legacySlugs.filter((slug) => legacyLocationSlugs.has(slug))));
}

export function getCompatibleCoverageNodeSlugs(slugs: string[]): string[] {
  const compatible = slugs.flatMap((slug) => {
    const node = nodeBySlug.get(slug);
    if (!node) return [];
    return [
      slug,
      ...getAncestorNodeSlugs(slug),
      ...getDescendantNodeSlugs(node),
    ];
  });
  return normalizeCoverageNodeSlugs(Array.from(new Set(compatible)));
}

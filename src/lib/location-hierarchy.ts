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

export const LOCATION_TREE: LocationNode[] = [
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

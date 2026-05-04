export type LocationExplorerChild = {
  slug: string;
  name: string;
  type: "Region" | "Group" | "Island" | "City" | "Spot";
  children?: LocationExplorerChild[];
};

export type LocationExplorerRegion = {
  slug: string;
  name: string;
  shortName: string;
  scope: "mainland" | "islands";
  center: [number, number];
  mapZoom: number;
  summary: string;
  bestFor: string[];
  vibes: string[];
  highlight: string;
  photographerHref: string;
  children: LocationExplorerChild[];
};

export const LOCATION_EXPLORER_REGIONS: LocationExplorerRegion[] = [
  {
    slug: "lisbon-region",
    name: "Lisbon Region",
    shortName: "Lisbon",
    scope: "mainland",
    center: [-9.18, 38.73],
    mapZoom: 8.3,
    summary: "City streets, tiled viewpoints, Atlantic beaches, palaces, and sunset cliffs within one compact region.",
    bestFor: ["Couples", "Family", "Proposal", "Solo"],
    vibes: ["City", "Coast", "Historic"],
    highlight: "Most flexible region for first-time visitors",
    photographerHref: "/photographers?location=lisbon-region",
    children: [
      { slug: "lisbon", name: "Lisbon", type: "City" },
      { slug: "sintra", name: "Sintra", type: "City" },
      { slug: "cascais", name: "Cascais", type: "City" },
      { slug: "ericeira", name: "Ericeira", type: "City" },
      { slug: "caparica", name: "Costa da Caparica", type: "City" },
      { slug: "almada", name: "Almada", type: "City" },
      { slug: "setubal", name: "Setubal", type: "City" },
      { slug: "sesimbra", name: "Sesimbra", type: "City" },
      { slug: "arrabida", name: "Arrabida", type: "Spot" },
      { slug: "comporta", name: "Comporta", type: "City" },
    ],
  },
  {
    slug: "porto-north",
    name: "Porto & North",
    shortName: "Porto",
    scope: "mainland",
    center: [-8.43, 41.42],
    mapZoom: 7.2,
    summary: "Porto, wine country, old stone towns, green mountains, and dramatic river light.",
    bestFor: ["Couples", "Engagement", "Family", "Wedding"],
    vibes: ["City", "Nature", "Historic"],
    highlight: "Best mix of city, vineyards, and northern atmosphere",
    photographerHref: "/photographers?location=porto-north",
    children: [
      { slug: "porto", name: "Porto", type: "City" },
      { slug: "douro-valley", name: "Douro Valley", type: "Region" },
      { slug: "braga", name: "Braga", type: "City" },
      { slug: "guimaraes", name: "Guimaraes", type: "City" },
      { slug: "geres", name: "Geres", type: "Region" },
    ],
  },
  {
    slug: "central-portugal",
    name: "Central Portugal",
    shortName: "Central",
    scope: "mainland",
    center: [-8.36, 40.12],
    mapZoom: 7.1,
    summary: "Surf towns, medieval villages, university streets, forests, monasteries, and wide coastal light.",
    bestFor: ["Family", "Solo", "Couples", "Content"],
    vibes: ["Coast", "Nature", "Historic"],
    highlight: "Strong for road trips and quieter Portugal stories",
    photographerHref: "/photographers?location=central-portugal",
    children: [
      { slug: "aveiro", name: "Aveiro", type: "City" },
      { slug: "coimbra", name: "Coimbra", type: "City" },
      { slug: "peniche", name: "Peniche", type: "City" },
      { slug: "nazare", name: "Nazare", type: "City" },
      { slug: "obidos", name: "Obidos", type: "City" },
      { slug: "tomar", name: "Tomar", type: "City" },
    ],
  },
  {
    slug: "alentejo",
    name: "Alentejo",
    shortName: "Alentejo",
    scope: "mainland",
    center: [-7.91, 38.57],
    mapZoom: 7.2,
    summary: "Whitewashed towns, vineyards, quiet squares, golden fields, and slower romantic light.",
    bestFor: ["Wedding", "Couples", "Elopement", "Family"],
    vibes: ["Nature", "Historic", "Quiet"],
    highlight: "Best for calm, editorial, sun-drenched shoots",
    photographerHref: "/photographers?location=alentejo",
    children: [{ slug: "evora", name: "Evora", type: "City" }],
  },
  {
    slug: "algarve",
    name: "Algarve",
    shortName: "Algarve",
    scope: "mainland",
    center: [-8.18, 37.1],
    mapZoom: 7.6,
    summary: "Sea caves, cliff beaches, old towns, marina evenings, and warm southern light.",
    bestFor: ["Family", "Couples", "Proposal", "Honeymoon"],
    vibes: ["Coast", "Nature", "Sunny"],
    highlight: "Most popular region for beach photoshoots",
    photographerHref: "/photographers?location=algarve",
    children: [
      { slug: "lagos", name: "Lagos", type: "City" },
      { slug: "albufeira", name: "Albufeira", type: "City" },
      { slug: "faro", name: "Faro", type: "City" },
      { slug: "tavira", name: "Tavira", type: "City" },
      { slug: "portimao", name: "Portimao", type: "City" },
      { slug: "vilamoura", name: "Vilamoura", type: "City" },
    ],
  },
  {
    slug: "madeira",
    name: "Madeira",
    shortName: "Madeira",
    scope: "islands",
    center: [-16.95, 32.75],
    mapZoom: 9.2,
    summary: "Mountain roads, black-sand beaches, green cliffs, botanical gardens, and ocean viewpoints.",
    bestFor: ["Couples", "Honeymoon", "Elopement", "Content"],
    vibes: ["Islands", "Nature", "Dramatic"],
    highlight: "Best island choice for cliffs and mountain drama",
    photographerHref: "/photographers?location=madeira",
    children: [{ slug: "funchal", name: "Funchal", type: "City" }],
  },
  {
    slug: "azores",
    name: "Azores",
    shortName: "Azores",
    scope: "islands",
    center: [-25.67, 37.74],
    mapZoom: 7.1,
    summary: "Nine volcanic islands with lagoons, hydrangeas, tea fields, black rock coast, and wild Atlantic landscapes.",
    bestFor: ["Honeymoon", "Elopement", "Couples", "Adventure"],
    vibes: ["Islands", "Nature", "Dramatic"],
    highlight: "Now split by island groups and individual islands",
    photographerHref: "/photographers?location=azores",
    children: [
      {
        slug: "azores-eastern-group",
        name: "Eastern Group",
        type: "Group",
        children: [
          {
            slug: "sao-miguel",
            name: "Sao Miguel",
            type: "Island",
            children: [{ slug: "ponta-delgada", name: "Ponta Delgada", type: "City" }],
          },
          { slug: "santa-maria", name: "Santa Maria", type: "Island" },
        ],
      },
      {
        slug: "azores-central-group",
        name: "Central Group",
        type: "Group",
        children: [
          { slug: "terceira", name: "Terceira", type: "Island" },
          { slug: "graciosa", name: "Graciosa", type: "Island" },
          { slug: "sao-jorge", name: "Sao Jorge", type: "Island" },
          { slug: "pico", name: "Pico", type: "Island" },
          { slug: "faial", name: "Faial", type: "Island" },
        ],
      },
      {
        slug: "azores-western-group",
        name: "Western Group",
        type: "Group",
        children: [
          { slug: "flores", name: "Flores", type: "Island" },
          { slug: "corvo", name: "Corvo", type: "Island" },
        ],
      },
    ],
  },
];

export const LOCATION_EXPLORER_SHOOT_FILTERS = [
  "Couples",
  "Family",
  "Proposal",
  "Wedding",
  "Elopement",
  "Honeymoon",
] as const;

export const LOCATION_EXPLORER_VIBE_FILTERS = [
  "City",
  "Coast",
  "Nature",
  "Historic",
  "Islands",
  "Dramatic",
] as const;

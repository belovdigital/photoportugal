export interface LocationService {
  /** Shoot-type slug matching shoot-types-data.ts (e.g. "couples", "family") */
  shootTypeSlug: string;
  /** Display label shown in the card heading */
  label: string;
  /** 2-3 sentence SEO description tailored to *this* city + service combo */
  description: string;
}

/**
 * City+service content for the top 8 locations.
 * Key = location slug, value = array of relevant service types.
 * Locations not listed here simply skip the section.
 */
export const locationServices: Record<string, LocationService[]> = {
  lisbon: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "Lisbon's colorful streets, romantic viewpoints, and golden light make it Portugal's most popular destination for couples photography. From Alfama's intimate alleyways to sweeping Tagus views, every corner tells a love story.",
    },
    {
      shootTypeSlug: "family",
      label: "Family",
      description:
        "Kid-friendly plazas, waterfront promenades, and the iconic Tram 28 create playful backdrops for family sessions. Lisbon's relaxed pace means no rushing between locations.",
    },
    {
      shootTypeSlug: "proposal",
      label: "Proposal",
      description:
        "Plan a surprise proposal at a private miradouro with panoramic views. Your photographer hides nearby, capturing the moment and the celebration that follows.",
    },
    {
      shootTypeSlug: "solo",
      label: "Solo",
      description:
        "Traveling solo? Get stunning portraits in Lisbon's most photogenic spots — no selfie stick needed.",
    },
  ],

  porto: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "The Ribeira waterfront, Dom Luis bridge at sunset, and Porto's romantic wine cellars create an unforgettable backdrop for couples.",
    },
    {
      shootTypeSlug: "family",
      label: "Family",
      description:
        "Porto's riverfront walks, Jardins do Palacio de Cristal, and colorful Ribeira streets are perfect for relaxed family sessions.",
    },
    {
      shootTypeSlug: "engagement",
      label: "Engagement",
      description:
        "Celebrate your engagement against Porto's dramatic river views and historic architecture.",
    },
  ],

  sintra: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "Fairytale palaces, enchanted forests, and misty gardens — Sintra is pure magic for couples photography.",
    },
    {
      shootTypeSlug: "engagement",
      label: "Engagement",
      description:
        "Pena Palace's colorful terraces and Quinta da Regaleira's mystical gardens create engagement photos unlike anywhere else.",
    },
    {
      shootTypeSlug: "elopement",
      label: "Elopement",
      description:
        "Intimate elopements in Sintra's palace gardens combine royal grandeur with forest privacy.",
    },
  ],

  algarve: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "Golden cliffs, hidden beaches, and dramatic sea caves — the Algarve's coastline is a couples photography paradise.",
    },
    {
      shootTypeSlug: "family",
      label: "Family",
      description:
        "Wide sandy beaches, calm waters, and colorful fishing towns make the Algarve ideal for relaxed family sessions.",
    },
    {
      shootTypeSlug: "honeymoon",
      label: "Honeymoon",
      description:
        "Celebrate your honeymoon with a photoshoot on the Algarve's most stunning cliff-top locations.",
    },
    {
      shootTypeSlug: "proposal",
      label: "Proposal",
      description:
        "Propose on a private cliff overlooking the Atlantic — dramatic and unforgettable.",
    },
  ],

  lagos: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "Ponta da Piedade's rock formations and Praia do Camilo's golden stairs make Lagos a couples photography gem.",
    },
    {
      shootTypeSlug: "family",
      label: "Family",
      description:
        "Lagos' old town plazas and calm beaches are perfect for families with young children.",
    },
  ],

  cascais: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "A seaside escape just 30 minutes from Lisbon — Cascais combines beach elegance with old-world charm for couples.",
    },
    {
      shootTypeSlug: "family",
      label: "Family",
      description:
        "Cascais' promenades, marina, and calm beaches make it an easy, beautiful family session location.",
    },
  ],

  madeira: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "Dramatic cliffs, tropical gardens, and mountain peaks — Madeira offers couples photography with adventure.",
    },
    {
      shootTypeSlug: "honeymoon",
      label: "Honeymoon",
      description:
        "Madeira's unique landscapes — from Cabo Girao to Monte Palace — create unforgettable honeymoon memories.",
    },
  ],

  azores: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "Volcanic lakes, hot springs, and lush green calderas — the Azores offer couples photography in truly unique landscapes.",
    },
    {
      shootTypeSlug: "solo",
      label: "Solo",
      description:
        "The Azores' dramatic wilderness is perfect for bold solo portrait photography.",
    },
  ],
};

/**
 * Returns the service-type content for a location, or an empty array
 * if the location is not in the top-8 list.
 */
export function getLocationServices(slug: string): LocationService[] {
  return locationServices[slug] ?? [];
}

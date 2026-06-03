/** A single curated image of the spot (Wikimedia / Unsplash / photographer
 *  portfolio). Attribution is required because Wikimedia CC-BY-SA images
 *  must show photographer credit + license to stay legal. */
export interface SpotImage {
  url: string;
  attribution: string;
  /** Where this image came from. Drives credit format and lets us later
   *  prefer photographer images over public-domain ones once tagging is live. */
  source: "wikimedia" | "unsplash" | "photographer";
  /** Click-through for the credit (Wikimedia file page, photographer profile, etc.) */
  source_url?: string;
  alt?: string;
  /** Image natural dims when known — drives masonry aspect ratios so layout
   *  doesn't reflow when photos load. */
  width?: number;
  height?: number;
}

export interface PhotoSpot {
  name: string;
  description: string;
  /** Portuguese translations; when absent, EN fallback is used on /pt. */
  namePt?: string;
  descriptionPt?: string;
  /** German translations; when absent, EN fallback is used on /de. */
  nameDe?: string;
  descriptionDe?: string;
  /** Spanish translations; when absent, EN fallback is used on /es. */
  nameEs?: string;
  descriptionEs?: string;
  /** French translations; when absent, EN fallback is used on /fr. */
  nameFr?: string;
  descriptionFr?: string;
  /** Long-form description — 3–4 paragraphs covering what the place is, why
   *  photographers love it, light/angle notes, practical tips. Falls back to
   *  `description` when missing so old data still renders. */
  long_description?: string;
  long_description_pt?: string;
  long_description_de?: string;
  long_description_es?: string;
  long_description_fr?: string;
  best_time?: string;
  best_timePt?: string;
  best_timeDe?: string;
  best_timeEs?: string;
  best_timeFr?: string;
  tips?: string;
  tipsPt?: string;
  tipsDe?: string;
  tipsEs?: string;
  tipsFr?: string;
  /** Optional shoot-type slugs this spot is especially good for.
   *  On a /locations/{city}/{occasion} page, spots with a matching tag
   *  bubble to the top of the list; untagged spots still render below. */
  tags?: string[];
  /** Curated photos of the spot. First image is used as hero. Empty/missing
   *  means the page falls back to the city cover. */
  images?: SpotImage[];
  /** Lat/lng for the spot — used by the map layer on /locations/[slug]
   *  (planned) and by the directions deep-link in the sidebar. */
  coordinates?: { lat: number; lng: number };
  /** Postal address fragment — feeds the structured-data block + Google Maps
   *  deep-link. Optional; falls back to "<spot>, <city>, Portugal". */
  address?: string;
}

/** Stable rerank that pulls spots tagged with `occasion` to the front. */
export function sortSpotsByOccasion(spots: PhotoSpot[], occasion?: string | null): PhotoSpot[] {
  if (!occasion) return spots;
  const matched: PhotoSpot[] = [];
  const rest: PhotoSpot[] = [];
  for (const s of spots) (s.tags?.includes(occasion) ? matched : rest).push(s);
  return [...matched, ...rest];
}

export function spotSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getSpot(citySlug: string, slug: string): PhotoSpot | undefined {
  const found = (photoSpots[citySlug] || []).find((s) => spotSlug(s.name) === slug);
  if (!found) return undefined;
  // Merge in coordinates + images from SPOT_MEDIA when the spot itself
  // doesn't carry them inline. Lets us add coords/photos for ~70 spots
  // in one map literal instead of editing every entry in this file.
  // Inline data wins so the 8 priority spots (Pena Palace, Quinta da
  // Regaleira, Belém, Alfama, etc.) keep their hand-tuned image lists.
  // Lazy-required so this module stays tree-shakeable for callers that
  // only need the catalog (e.g. concierge system prompt builder).
  const isMissingMedia = !found.coordinates || !found.images || found.images.length === 0;
  if (!isMissingMedia) return found;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SPOT_MEDIA } = require("./spot-media") as typeof import("./spot-media");
  const key = `${citySlug}/${slug}`;
  const media = SPOT_MEDIA[key];
  if (!media) return found;
  return {
    ...found,
    coordinates: found.coordinates ?? media.coordinates,
    images: (found.images && found.images.length > 0) ? found.images : media.images,
  };
}

/** Variant of getSpot that returns ALL spots in a city with media merged
 *  in. Used by the /locations/[slug] CityMap so every spot gets a pin
 *  even if its inline entry doesn't have coordinates yet. */
export function getSpotsWithMediaForCity(citySlug: string): (PhotoSpot & { citySlug: string; spotSlug: string })[] {
  const list = photoSpots[citySlug] || [];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SPOT_MEDIA } = require("./spot-media") as typeof import("./spot-media");
  return list.map((s) => {
    const sl = spotSlug(s.name);
    const media = SPOT_MEDIA[`${citySlug}/${sl}`];
    return {
      ...s,
      citySlug,
      spotSlug: sl,
      coordinates: s.coordinates ?? media?.coordinates,
      images: (s.images && s.images.length > 0) ? s.images : media?.images,
    };
  });
}

/** Returns name/description in the requested locale, falling back to EN. */
export function spotLocalized(spot: PhotoSpot, locale: string) {
  const suffix = locale === "pt" ? "Pt" : locale === "de" ? "De" : locale === "es" ? "Es" : locale === "fr" ? "Fr" : "";
  const pick = <K extends "name" | "description" | "best_time" | "tips">(base: K): string | undefined => {
    if (!suffix) return spot[base] as string | undefined;
    const k = `${base}${suffix}` as keyof PhotoSpot;
    return (spot[k] as string | undefined) || (spot[base] as string | undefined);
  };
  // long_description uses snake_case suffix (long_description_pt, not
  // long_descriptionPt) since it landed later in the codebase — keep
  // both naming conventions wired to the same lookup.
  const longSuffixMap: Record<string, string> = { Pt: "_pt", De: "_de", Es: "_es", Fr: "_fr" };
  const longKey = suffix ? `long_description${longSuffixMap[suffix]}` as keyof PhotoSpot : undefined;
  const long_description = longKey
    ? ((spot[longKey] as string | undefined) || spot.long_description)
    : spot.long_description;
  return {
    name: pick("name") || spot.name,
    description: pick("description") || spot.description,
    long_description,
    best_time: pick("best_time"),
    tips: pick("tips"),
  };
}

/** Top photography spots per location slug */
export const photoSpots: Record<string, PhotoSpot[]> = {
  lisbon: [
    { name: "Miradouro da Graca", namePt: "Miradouro da Graça", nameDe: "Miradouro da Graça", nameEs: "Miradouro da Graça", nameFr: "Miradouro da Graça",
      description: "One of Lisbon's most scenic viewpoints with panoramic views over the city rooftops and the Tagus River — perfect for golden hour portraits.",
      descriptionPt: "Um dos miradouros mais cénicos de Lisboa, com vistas panorâmicas sobre os telhados da cidade e o rio Tejo — perfeito para retratos ao pôr do sol.",
      descriptionDe: "Einer der schönsten Aussichtspunkte Lissabons mit Panoramablick über die Dächer der Stadt und den Tejo — ideal für Porträts in der goldenen Stunde.",
      descriptionEs: "Uno de los miradores más pintorescos de Lisboa, con vistas panorámicas sobre los tejados de la ciudad y el río Tajo — perfecto para retratos a la hora dorada.",
      descriptionFr: "L'un des belvédères les plus pittoresques de Lisbonne, avec une vue panoramique sur les toits de la ville et le Tage — parfait pour des portraits à l'heure dorée." },
    { name: "Alfama", namePt: "Alfama", nameDe: "Alfama", nameEs: "Alfama", nameFr: "Alfama",
      description: "The oldest neighborhood in Lisbon, with narrow cobblestone streets, colorful azulejo-tiled facades, and authentic Portuguese atmosphere.",
      descriptionPt: "O bairro mais antigo de Lisboa, com ruas estreitas de calçada, fachadas coloridas de azulejos e uma atmosfera autenticamente portuguesa.",
      descriptionDe: "Das älteste Viertel Lissabons mit engen Kopfsteinpflastergassen, farbenfrohen Azulejo-Fassaden und authentisch portugiesischer Atmosphäre.",
      descriptionEs: "El barrio más antiguo de Lisboa, con estrechas calles empedradas, fachadas coloridas de azulejos y un ambiente auténticamente portugués.",
      descriptionFr: "Le plus ancien quartier de Lisbonne, avec ses ruelles pavées étroites, ses façades colorées d'azulejos et son atmosphère authentiquement portugaise.",
      long_description: "Alfama is what you came to Lisbon for — a labyrinth of narrow lanes, azulejo-tiled walls, fluttering laundry, and the smell of grilled sardines that survived the 1755 earthquake more or less intact. It's the city's oldest neighbourhood and its most photographed: every corner is a postcard, every staircase frames a different view of the Tagus.\n\nBest shooting strategy is movement, not destination. Have your photographer walk you through Beco do Carneiro, Largo das Portas do Sol (the iconic miradouro overlooking the river and São Vicente monastery), the steep stairs near Largo de Santo Estêvão, and the tiny Beco da Cardosa. Yellow Tram 28 passing on Rua das Escolas Gerais is a classic shot — wait for it rather than chase it. Wear something that pops against neutral stone — soft red, mustard, or denim — but flat shoes are non-negotiable on cobblestones.\n\nPractical: best light is early morning (7–9am, before tourist crowds) or late afternoon. Sunday mornings the Feira da Ladra flea market spills into the streets, adding texture but also more bystanders. Free to photograph everywhere; respect signage in private patios. Tram 28 fills up by 10am — for vintage-tram shots come at 8am to the Largo Martim Moniz starting point. The whole district is walkable but expect 200m of vertical climb across a 90-min session.",
      coordinates: { lat: 38.7117, lng: -9.1304 },
      images: [
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Alfama%2C_Lisbon_%28DSC03367%29.jpg/1920px-Alfama%2C_Lisbon_%28DSC03367%29.jpg", attribution: "Matti Blume", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Alfama,_Lisbon_(DSC03367).jpg", alt: "Alfama narrow tile-faced street", width: 1920, height: 1285 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Alfama%2C_Lisbon_%28DSC03373%29.jpg/1920px-Alfama%2C_Lisbon_%28DSC03373%29.jpg", attribution: "Matti Blume", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Alfama,_Lisbon_(DSC03373).jpg", alt: "Alfama winding alley", width: 1920, height: 1285 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Lissabon_-_Alfama_-_Rua_da_Adica_-_1.jpg/1920px-Lissabon_-_Alfama_-_Rua_da_Adica_-_1.jpg", attribution: "Ingo Mehling", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Lissabon_-_Alfama_-_Rua_da_Adica_-_1.jpg", alt: "Rua da Adiça stairs in Alfama", width: 1168, height: 1920 },
      ],
    },
    { name: "Belem Tower", namePt: "Torre de Belém", nameDe: "Belém-Turm", nameEs: "Torre de Belém", nameFr: "Tour de Belém",
      description: "The iconic 16th-century riverside fortress and UNESCO World Heritage site, ideal for dramatic architectural backdrops.",
      descriptionPt: "A icónica fortaleza ribeirinha do século XVI, Património Mundial da UNESCO, ideal para cenários arquitetónicos dramáticos.",
      descriptionDe: "Die ikonische Festung am Tejo aus dem 16. Jahrhundert und UNESCO-Welterbe — ideal für eindrucksvolle architektonische Kulissen.",
      descriptionEs: "La icónica fortaleza ribereña del siglo XVI, Patrimonio de la Humanidad de la UNESCO, ideal para escenarios arquitectónicos dramáticos.",
      descriptionFr: "L'emblématique forteresse du XVIe siècle au bord du fleuve, classée au patrimoine mondial de l'UNESCO — idéale pour des décors architecturaux saisissants.",
      long_description: "Belém Tower is the 16th-century departure point for Portugal's Age of Discovery — a Manueline fortress built into the Tagus river that watched explorers leave for India, Brazil, and the Far East. Today it's the silhouette every Lisbon postcard fights over, with carved sea-monsters, lacy stonework, and a riverside terrace that's been pulling photographers for over a century.\n\nThe shooting angle most people miss: the wide pedestrian path that runs east of the tower along the river. From there you get clean architectural backdrops without other tourists in frame, especially before 9am. The lawn directly south of the tower offers full-length compositions with the tower as backdrop. Sunset shots looking west are dramatic but the sun goes behind the tower — exposure-tricky, ideal for silhouettes. The tower itself glows softest gold around 30 minutes before sunset.\n\nPractical: free to photograph from outside (the lawns and riverside path are public). Interior visit €8 with a long queue 11am–3pm. Parking is a real headache — use the metro to Belém station (10-min walk) or bring an Uber. No drone shots — Tagus is restricted airspace and security is active. Combine with the nearby Jerónimos Monastery (5-min walk) for a 2-hour Belém district session covering both UNESCO sites.",
      coordinates: { lat: 38.6916, lng: -9.2160 },
      images: [
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Lisbon_Torre_de_Bel%C3%A9m_BW_2018-10-03_16-33-21.jpg/1920px-Lisbon_Torre_de_Bel%C3%A9m_BW_2018-10-03_16-33-21.jpg", attribution: "Berthold Werner", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Lisbon_Torre_de_Bel%C3%A9m_BW_2018-10-03_16-33-21.jpg", alt: "Belém Tower from the south lawn", width: 1920, height: 1402 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Torre_Bel%C3%A9m_April_2009-4a.jpg/1920px-Torre_Bel%C3%A9m_April_2009-4a.jpg", attribution: "Alvesgaspar", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Torre_Bel%C3%A9m_April_2009-4a.jpg", alt: "Belém Tower riverside view", width: 1920, height: 1832 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Torre_de_Belem_-_Backside.jpg/1920px-Torre_de_Belem_-_Backside.jpg", attribution: "Ingo Mehling", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Torre_de_Belem_-_Backside.jpg", alt: "Belém Tower backside, vertical", width: 1342, height: 1920 },
      ],
    },
    { name: "LX Factory", namePt: "LX Factory", nameDe: "LX Factory", nameEs: "LX Factory", nameFr: "LX Factory",
      description: "A trendy creative hub in a converted industrial complex, offering street art, vibrant murals, and an urban-cool photoshoot aesthetic.",
      descriptionPt: "Um polo criativo num antigo complexo industrial reconvertido, com street art, murais vibrantes e uma estética urbana para sessões fotográficas.",
      descriptionDe: "Ein angesagter Kreativhub in einem umgebauten Industriekomplex mit Street-Art, lebendigen Wandbildern und urbanem Flair für Fotoshootings.",
      descriptionEs: "Un moderno polo creativo en un antiguo complejo industrial reconvertido, con arte urbano, murales vibrantes y una estética urbana ideal para sesiones fotográficas.",
      descriptionFr: "Un pôle créatif tendance dans un ancien complexe industriel réhabilité, avec du street art, des fresques vibrantes et une esthétique urbaine pour les séances photo.",
      long_description: "LX Factory was once a 19th-century textile complex; today it's Lisbon's coolest 23,000m² creative campus, packed with street art, independent shops, restaurants, the famous Ler Devagar bookshop with its bicycle-flying sculpture, and constantly-rotating murals. Located in Alcântara under the 25 de Abril Bridge, it's the polar opposite of Alfama — gritty, contemporary, unapologetically urban.\n\nIt's the spot for content creators, branding shoots, fashion editorials, and anyone who wants their Lisbon photos to look nothing like a tourist's. Key zones: the central Rua Rodrigues de Faria with its painted walls and outdoor seating; Ler Devagar (interior shoots possible if discreet — bookshop hours only); the rooftop terrace at Rio Maravilha for skyline backdrops with the bridge; the back industrial alley with rust, exposed brick, and graffiti murals that change quarterly. The look that works: streetwear, oversized blazers, bold accessories — stuff that competes visually rather than blending in.\n\nPractical: free entry, open daily but properly alive Friday evening through Sunday. Saturdays are crowded (street market) but most photogenic. Photography is generally fine but ask before shooting inside individual shops and at the Sunday brunch venues (private events common). Free street parking is impossible — Uber to the entrance or take tram 15E to Calvário. Combine with the nearby Tagus riverside walk and the LX Factory rooftop for sunset.",
      coordinates: { lat: 38.7042, lng: -9.1791 },
      images: [
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/LX_Factory_Lisbon_%2843450749470%29.jpg/1920px-LX_Factory_Lisbon_%2843450749470%29.jpg", attribution: "TJ DeGroat", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:LX_Factory_Lisbon_(43450749470).jpg", alt: "LX Factory street with murals", width: 1440, height: 1920 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/LX_Factory_Lisbon_%2844543156954%29.jpg/1920px-LX_Factory_Lisbon_%2844543156954%29.jpg", attribution: "TJ DeGroat", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:LX_Factory_Lisbon_(44543156954).jpg", alt: "LX Factory courtyard", width: 1440, height: 1920 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/c/ca/LX_Factory_Lisbon_%2844543155954%29.jpg", attribution: "TJ DeGroat", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:LX_Factory_Lisbon_(44543155954).jpg", alt: "LX Factory wall art detail", width: 1655, height: 2594 },
      ],
    },
    { name: "Praca do Comercio", namePt: "Praça do Comércio", nameDe: "Praça do Comércio", nameEs: "Praça do Comércio", nameFr: "Praça do Comércio",
      description: "Lisbon's grand waterfront square with its striking yellow arcades and the Triumphal Arch — a wide-open, elegant setting for group and couple photos.",
      descriptionPt: "A grande praça ribeirinha de Lisboa, com os seus característicos arcos amarelos e o Arco da Rua Augusta — um cenário amplo e elegante para fotos de grupo e casal.",
      descriptionDe: "Lissabons große Platzanlage am Wasser mit den markanten gelben Arkaden und dem Triumphbogen — ein weitläufiger, eleganter Rahmen für Gruppen- und Paarfotos.",
      descriptionEs: "La gran plaza ribereña de Lisboa, con sus llamativos arcos amarillos y el Arco del Triunfo — un escenario amplio y elegante para fotos de grupo y de pareja.",
      descriptionFr: "La grande place de Lisbonne au bord du fleuve, avec ses arcades jaunes saisissantes et l'Arc de Triomphe — un cadre vaste et élégant pour les photos de groupe et de couple." },
  ],
  porto: [
    { name: "Ribeira", namePt: "Ribeira", nameDe: "Ribeira", nameEs: "Ribeira", nameFr: "Ribeira",
      description: "The colorful UNESCO-listed riverfront district with stacked houses cascading down to the Douro — Porto's most iconic photoshoot location.",
      descriptionPt: "O colorido bairro ribeirinho classificado pela UNESCO, com casas empilhadas em cascata até ao Douro — o local mais icónico do Porto para sessões fotográficas.",
      descriptionDe: "Das farbenfrohe, von der UNESCO geschützte Flussufer-Viertel mit verschachtelten Häusern, die zum Douro hinabfallen — Portos ikonischste Fotoshooting-Kulisse.",
      descriptionEs: "El colorido barrio ribereño declarado Patrimonio de la UNESCO, con casas apiladas que descienden hasta el Duero — el lugar más icónico de Oporto para sesiones fotográficas.",
      descriptionFr: "Le quartier coloré au bord du fleuve, classé à l'UNESCO, avec ses maisons étagées qui descendent jusqu'au Douro — le décor de séance photo le plus emblématique de Porto.",
      long_description: "Ribeira is what every Porto search-result photo shows — a tightly stacked mosaic of orange, ochre, and sunbleached-white houses tumbling down to the Douro waterfront, with the iron Dom Luís I bridge spanning above. UNESCO-listed since 1996, it's still very much a working neighbourhood: laundry hangs from balconies, locals fish off the quays, and the rabelo wine boats sway at the docks across the river.\n\nFor photoshoots the trick is composition variety in a small footprint. Cais da Ribeira (the main quay) gives you the wide bridge backdrop. Praça da Ribeira — the small square one block in — has the iconic painted facades and a 16th-century fountain that frames couple/family compositions perfectly. The narrow stairs of Escadas do Codeçal and Rua Fonte Taurina provide layered architectural depth. Cross the bridge to Vila Nova de Gaia for reverse shots looking back at Ribeira — late-afternoon golden hour is unbeatable from there. Wear neutrals or jewel tones; avoid orange or yellow which clash with the facades.\n\nPractical: pedestrian zone, free to photograph everywhere outside private cafés. Sunset light on the facades is famous and famously crowded — go an hour earlier or pick weekday mornings. Tram 1 from São Bento to the river costs €3.50 and is a sweet bonus shot. Combine with São Bento Station (5-min walk uphill) for a full Porto-historic-centre session.",
      coordinates: { lat: 41.1407, lng: -8.6116 },
      images: [
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Cais_da_Ribeira%2C_Porto%2C_Portugal.jpg/1920px-Cais_da_Ribeira%2C_Porto%2C_Portugal.jpg", attribution: "Communeiro", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Cais_da_Ribeira,_Porto,_Portugal.jpg", alt: "Cais da Ribeira riverside facades, vertical", width: 1280, height: 1920 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Porto%27s_riverside_quarter%2C_known_as_the_Ribeira%2C_is_a_hub_for_tourists.jpg/1920px-Porto%27s_riverside_quarter%2C_known_as_the_Ribeira%2C_is_a_hub_for_tourists.jpg", attribution: "Peter K Burian", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Porto%27s_riverside_quarter,_known_as_the_Ribeira,_is_a_hub_for_tourists.jpg", alt: "Wide panorama of Ribeira waterfront", width: 1920, height: 955 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Tourists_enjoy_the_riverside_%28Ribeira%29_in_Porto.jpg/1920px-Tourists_enjoy_the_riverside_%28Ribeira%29_in_Porto.jpg", attribution: "Peter K Burian", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Tourists_enjoy_the_riverside_(Ribeira)_in_Porto.jpg", alt: "Ribeira riverside walkway", width: 1920, height: 1281 },
      ],
    },
    { name: "Dom Luis I Bridge", namePt: "Ponte Dom Luís I", nameDe: "Ponte Dom Luís I", nameEs: "Puente Don Luís I", nameFr: "Pont Dom Luís I",
      description: "The double-deck iron bridge offers dramatic framing with the Douro River and both sides of the city stretching below.",
      descriptionPt: "A ponte de ferro de dois tabuleiros oferece um enquadramento dramático com o rio Douro e ambas as margens da cidade em baixo.",
      descriptionDe: "Die doppelstöckige Eisenbrücke bietet eine eindrucksvolle Bildkomposition mit dem Douro und beiden Stadtufern darunter.",
      descriptionEs: "El puente de hierro de dos pisos ofrece un encuadre espectacular con el río Duero y ambas orillas de la ciudad extendiéndose debajo.",
      descriptionFr: "Le pont de fer à double tablier offre un cadrage saisissant sur le Douro et les deux rives de la ville qui s'étendent en contrebas." },
    { name: "Livraria Lello", namePt: "Livraria Lello", nameDe: "Livraria Lello", nameEs: "Livraria Lello", nameFr: "Livraria Lello",
      description: "One of the world's most beautiful bookshops, with a stunning neo-Gothic interior and the famous crimson staircase.",
      descriptionPt: "Uma das livrarias mais bonitas do mundo, com um interior neogótico deslumbrante e a famosa escadaria vermelha.",
      descriptionDe: "Eine der schönsten Buchhandlungen der Welt mit beeindruckendem neogotischem Interieur und der berühmten purpurroten Treppe.",
      descriptionEs: "Una de las librerías más hermosas del mundo, con un impresionante interior neogótico y la famosa escalera carmesí.",
      descriptionFr: "L'une des plus belles librairies du monde, avec un superbe intérieur néogothique et son célèbre escalier cramoisi.",
      long_description: "Livraria Lello opened in 1906 and has been called the most beautiful bookshop on Earth — a hyperbolic claim that holds up the second you walk in. The neo-Gothic facade conceals a small two-storey interior dominated by a curving crimson wooden staircase, ornate plasterwork, and a stained-glass skylight that floods the space with diffused light. J.K. Rowling lived in Porto in the early 90s, and while she's denied direct inspiration for Hogwarts, the resemblance is hard to unsee.\n\nFor portraits the staircase is THE shot — but it's also the busiest 3 square meters in Portugal. Photographers who've worked here recommend the very first slot when doors open or the last hour before closing, when the line dies down. The upper landing offers a wide composition framing the whole staircase below; the bottom step looking up at the skylight gives a different magic. The stained-glass ceiling gives the entire interior a soft warm cast that's flattering on skin. Wear deep navy, emerald, burgundy, or black — anything mid-tone earthy fights the saturated red of the woodwork.\n\nPractical: requires a pre-booked time-slot ticket (€8, deductible from any book purchase) — without it you don't get in, period. Tickets sell out same-day in summer; book the night before via the official site. Photography is permitted but tripods and flash are banned; a fast lens (f/1.8 or wider) handles the dim interior. Allow 25 minutes inside max — staff are professionals at moving people along.",
      coordinates: { lat: 41.1469, lng: -8.6147 },
      images: [
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Interior_view_of_Livraria_Lello_04.jpg/1920px-Interior_view_of_Livraria_Lello_04.jpg", attribution: "John Samuel", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Interior_view_of_Livraria_Lello_04.jpg", alt: "Livraria Lello interior — the red staircase", width: 1920, height: 1280 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Interior_view_of_Livraria_Lello_06.jpg/1920px-Interior_view_of_Livraria_Lello_06.jpg", attribution: "John Samuel", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Interior_view_of_Livraria_Lello_06.jpg", alt: "Livraria Lello upper landing", width: 1920, height: 1280 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Interior_view_of_Livraria_Lello_09.jpg/1920px-Interior_view_of_Livraria_Lello_09.jpg", attribution: "John Samuel", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Interior_view_of_Livraria_Lello_09.jpg", alt: "Livraria Lello stained-glass ceiling", width: 1920, height: 1280 },
      ],
    },
    { name: "Sao Bento Station", namePt: "Estação de São Bento", nameDe: "Bahnhof São Bento", nameEs: "Estación de São Bento", nameFr: "Gare de São Bento",
      description: "A railway station adorned with over 20,000 hand-painted azulejo tiles depicting Portuguese history — a unique indoor backdrop.",
      descriptionPt: "Uma estação ferroviária decorada com mais de 20 000 azulejos pintados à mão que retratam a história portuguesa — um cenário interior único.",
      descriptionDe: "Ein Bahnhof, der mit über 20 000 handbemalten Azulejo-Kacheln zur portugiesischen Geschichte geschmückt ist — eine einzigartige Indoor-Kulisse.",
      descriptionEs: "Una estación de tren decorada con más de 20 000 azulejos pintados a mano que retratan la historia portuguesa — un escenario interior único.",
      descriptionFr: "Une gare ornée de plus de 20 000 azulejos peints à la main retraçant l'histoire portugaise — un décor intérieur unique." },
    { name: "Serra do Pilar", namePt: "Serra do Pilar", nameDe: "Serra do Pilar", nameEs: "Serra do Pilar", nameFr: "Serra do Pilar",
      description: "A hilltop viewpoint on the Vila Nova de Gaia side, offering the classic panoramic shot of Porto's skyline and the Douro River.",
      descriptionPt: "Um miradouro no topo da colina em Vila Nova de Gaia, oferecendo a vista panorâmica clássica do skyline do Porto e do rio Douro.",
      descriptionDe: "Ein Aussichtspunkt auf einem Hügel in Vila Nova de Gaia mit der klassischen Panoramaaufnahme der Skyline Portos und des Douro.",
      descriptionEs: "Un mirador en lo alto de la colina de Vila Nova de Gaia que ofrece la clásica vista panorámica del horizonte de Oporto y el río Duero.",
      descriptionFr: "Un belvédère perché sur la colline du côté de Vila Nova de Gaia, offrant la vue panoramique classique sur les toits de Porto et le Douro." },
  ],
  sintra: [
    { name: "Pena Palace", namePt: "Palácio da Pena", nameDe: "Palácio da Pena", nameEs: "Palacio da Pena", nameFr: "Palais de Pena",
      description: "A Romanticist castle in vivid red and yellow perched on a misty hilltop, surrounded by enchanted gardens — pure fairytale magic.",
      descriptionPt: "Um castelo romântico em vermelho e amarelo vivos, no topo de uma colina enevoada, rodeado por jardins encantados — pura magia de conto de fadas.",
      descriptionDe: "Ein romantizistisches Schloss in leuchtendem Rot und Gelb auf einem nebligen Hügel, umgeben von verwunschenen Gärten — reine Märchenmagie.",
      descriptionEs: "Un castillo romántico en vivos tonos rojo y amarillo encaramado en una colina brumosa, rodeado de jardines encantados — pura magia de cuento de hadas.",
      descriptionFr: "Un château romantique aux teintes rouges et jaunes éclatantes perché sur une colline brumeuse, entouré de jardins enchantés — une pure magie de conte de fées.",
      long_description: "Pena Palace sits atop the Sintra mountains as Portugal's most photographed castle — a riot of yellow, red, and lilac walls in the Romantic style that made 19th-century king Ferdinand II's architectural fantasy world-famous. The drive up winds through the misty Sintra-Cascais Natural Park, and as you round the final bend the palace appears like something out of a children's book.\n\nFor couples and family shoots, the colourful exterior walls are the obvious draw — soft early-morning light hits the yellow tower from the east, while late afternoon gives the red dome golden warmth. The ornate Triton Gateway and the upper terrace facing the gardens both work as compact photo zones with minimal tourist traffic. Inside, photography is restricted to the courtyards. Wear something that contrasts with the bold colours — soft creams, sage, or denim — saturated outfits compete with the architecture.\n\nPractical notes: tickets are €14 (gardens-only €7.50); expect crowds 11am–3pm. Photographers usually book the 8–9am slot when the gates open, or the final hour before sunset. The 3km hike up from Sintra village is doable but most clients prefer a taxi or pre-booked driver — €15 each way. Mist below 800m is common and unpredictable; if you see fog, embrace it — the moody shots are often the best.",
      coordinates: { lat: 38.7876, lng: -9.3905 },
      images: [
        { url: "https://upload.wikimedia.org/wikipedia/commons/7/74/Sintra_Portugal_Pal%C3%A1cio_da_Pena-01.jpg", attribution: "CEphoto, Uwe Aranas", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Sintra_Portugal_Pal%C3%A1cio_da_Pena-01.jpg", alt: "Pena Palace, Sintra — full façade", width: 3500, height: 2333 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Pena_Palace%2C_Sintra%2C_Portugal%2C_20250606_1031_9983.jpg/1920px-Pena_Palace%2C_Sintra%2C_Portugal%2C_20250606_1031_9983.jpg", attribution: "Jakub Hałun", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Pena_Palace%2C_Sintra%2C_Portugal%2C_20250606_1031_9983.jpg", alt: "Pena Palace yellow tower close-up", width: 1920, height: 1281 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Pena_Palace_Clocktower.jpg/1920px-Pena_Palace_Clocktower.jpg", attribution: "Marcelpb 12", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Pena_Palace_Clocktower.jpg", alt: "Pena Palace clocktower, vertical view", width: 1080, height: 1920 },
      ],
    },
    { name: "Quinta da Regaleira", namePt: "Quinta da Regaleira", nameDe: "Quinta da Regaleira", nameEs: "Quinta da Regaleira", nameFr: "Quinta da Regaleira",
      description: "Mystical estate with the famous Initiation Well, underground tunnels, grottoes, and lush gardens that feel like a fantasy world.",
      descriptionPt: "Uma propriedade mística com o famoso Poço Iniciático, túneis subterrâneos, grutas e jardins exuberantes que parecem saídos de um mundo de fantasia.",
      descriptionDe: "Ein mystisches Anwesen mit dem berühmten Initiationsbrunnen, unterirdischen Tunneln, Grotten und üppigen Gärten — wie aus einer Fantasywelt.",
      descriptionEs: "Una finca mística con el famoso Pozo Iniciático, túneles subterráneos, grutas y jardines exuberantes que parecen sacados de un mundo de fantasía.",
      descriptionFr: "Un domaine mystique avec le célèbre Puits initiatique, des tunnels souterrains, des grottes et des jardins luxuriants dignes d'un monde de fantaisie.",
      long_description: "Quinta da Regaleira is a 4-hectare neo-Manueline estate built between 1904 and 1910 by an eccentric Brazilian millionaire and his Italian architect — and it shows. The grounds hide a network of grottoes, lakes, towers, and the headline-grabbing Initiation Well: a 27m-deep inverted spiral staircase descending into the rock, originally used in Masonic rituals.\n\nFor photoshoots this is one of Portugal's richest single locations because variety is built in. The well delivers its iconic top-down spiral shot (need to arrive early or it's queue-only). The Patamar dos Deuses terrace and the chapel facade work as romantic backdrops with directional afternoon light. The grottoes and lakeside paths give a moody, fairytale-forest feel — bring a flash for the cave sections. Wear earth tones (rust, olive, deep green) — they harmonise with the moss and stonework rather than clash.\n\nPractical: ticket €13, opens 09:30. The well is the bottleneck — go straight there on entry, before tour groups arrive. Shoots after 11am have noticeably more people and limited control over the spiral shot. Allow 90 minutes for a proper session — the estate is bigger than it looks. Tripods are technically not allowed inside the well and grottoes; handheld + a fast lens works best. Combine with Pena Palace in the morning for a full Sintra day.",
      coordinates: { lat: 38.7967, lng: -9.3961 },
      images: [
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Quinta_da_Regaleira_Initiation_Well_Top-Down_%2848680309187%29.jpg/1920px-Quinta_da_Regaleira_Initiation_Well_Top-Down_%2848680309187%29.jpg", attribution: "Ji Soo Song", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Quinta_da_Regaleira_Initiation_Well_Top-Down_(48680309187).jpg", alt: "Initiation Well — top-down spiral", width: 1920, height: 2532 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Quinta_da_Regaleira_Initiation_Well_Bottom-Up_%2848680367447%29.jpg/1920px-Quinta_da_Regaleira_Initiation_Well_Bottom-Up_%2848680367447%29.jpg", attribution: "Ji Soo Song", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Quinta_da_Regaleira_Initiation_Well_Bottom-Up_(48680367447).jpg", alt: "Initiation Well — view from bottom up", width: 1920, height: 2398 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Initiation_Well_in_Quinta_da_Regaleira_-_Sintra_%2816277476688%29.jpg", attribution: "Glyn Lowe", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Initiation_Well_in_Quinta_da_Regaleira_-_Sintra_(16277476688).jpg", alt: "Initiation Well moss-covered staircase", width: 1024, height: 684 },
      ],
    },
    { name: "National Palace", namePt: "Palácio Nacional de Sintra", nameDe: "Nationalpalast von Sintra", nameEs: "Palacio Nacional de Sintra", nameFr: "Palais national de Sintra",
      description: "The medieval royal palace in the heart of Sintra village, with its distinctive twin conical chimneys and ornate Moorish interiors.",
      descriptionPt: "O palácio real medieval no centro de Sintra, com as suas distintivas chaminés cónicas gémeas e interiores ornamentados de influência mourisca.",
      descriptionDe: "Der mittelalterliche Königspalast im Herzen von Sintra mit den charakteristischen kegelförmigen Zwillingsschornsteinen und maurisch geprägten Innenräumen.",
      descriptionEs: "El palacio real medieval en el corazón del pueblo de Sintra, con sus distintivas chimeneas cónicas gemelas e interiores ornamentados de influencia morisca.",
      descriptionFr: "Le palais royal médiéval au cœur du village de Sintra, avec ses cheminées coniques jumelles caractéristiques et ses intérieurs ornés d'influence mauresque." },
    { name: "Monserrate Palace", namePt: "Palácio de Monserrate", nameDe: "Palácio de Monserrate", nameEs: "Palacio de Monserrate", nameFr: "Palais de Monserrate",
      description: "An exotic 19th-century palace with Moorish, Gothic, and Indian influences, set in romantic botanical gardens with rare plant species.",
      descriptionPt: "Um palácio exótico do século XIX com influências mouriscas, góticas e indianas, rodeado de jardins botânicos românticos com espécies raras.",
      descriptionDe: "Ein exotischer Palast aus dem 19. Jahrhundert mit maurischen, gotischen und indischen Einflüssen, eingebettet in romantische botanische Gärten mit seltenen Pflanzen.",
      descriptionEs: "Un exótico palacio del siglo XIX con influencias moriscas, góticas e indias, rodeado de románticos jardines botánicos con especies vegetales raras.",
      descriptionFr: "Un palais exotique du XIXe siècle aux influences mauresques, gothiques et indiennes, niché dans de romantiques jardins botaniques aux espèces rares." },
  ],
  algarve: [
    { name: "Benagil Cave", namePt: "Gruta de Benagil", nameDe: "Benagil-Höhle", nameEs: "Cueva de Benagil", nameFr: "Grotte de Benagil", coordinates: { lat: 37.0894, lng: -8.4258 },
      long_description: "Benagil Cave is the Algarve's signature image — a vast natural sea cave carved into the limestone cliffs near Lagoa, with two arched entrances open to the ocean and a perfect circular skylight overhead. Sunlight pours through the oculus onto the small sandy beach inside, creating the surreal cathedral effect that put this single cave on every Portugal travel feed.\n\nFor photoshoots this is logistically the hardest spot on Photo Portugal — and the most rewarding. You can't reach the interior on foot. Options: kayak (40-min paddle round-trip from Benagil beach, €25/person rental), SUP, organised boat tour (drops you for 5–10 minutes inside, €25–35), or swimming from the beach when sea conditions allow (technically risky, no longer encouraged). Most photographers do the kayak option — slower, but you control how long you stay, you can get out on the small inner beach, and the dawn light through the oculus is otherworldly. Wear what you'd swim in; everything will get wet.\n\nPractical: best season May–September, calm seas. Inside the cave the morning sun (8–10am) hits the inner beach directly through the oculus; midday the light is overhead and harsh; afternoon goes flat as the sun moves west. Book any kayak/boat at least 2 days ahead in summer. Bring waterproof bag for camera. Combine with the cliff-top Algar de Benagil viewpoint (small inland walk to a fence overlooking the oculus from above — different but also iconic). The closest base is Carvoeiro or Albufeira; Lagos is 40 minutes by car.",
      images: [
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Benagil_Cave_%283%29.jpg/1920px-Benagil_Cave_%283%29.jpg", attribution: "Joseolgon", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Benagil_Cave_(3).jpg", alt: "Benagil Cave interior with sun through oculus", width: 1920, height: 1280 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Benagil_Cave_%288%29.jpg/1920px-Benagil_Cave_%288%29.jpg", attribution: "Joseolgon", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:Benagil_Cave_(8).jpg", alt: "Benagil Cave seen from the water", width: 1920, height: 1280 },
        { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/004_Tourist_reading_information_signs_about_rockfall_danger_and_cave_swimming_danger_in_Benagil_Beach%2C_Algarve%2C_Portugal.jpg/1920px-004_Tourist_reading_information_signs_about_rockfall_danger_and_cave_swimming_danger_in_Benagil_Beach%2C_Algarve%2C_Portugal.jpg", attribution: "Marek Slusarczyk", source: "wikimedia", source_url: "https://commons.wikimedia.org/wiki/File:004_Tourist_reading_information_signs_about_rockfall_danger_and_cave_swimming_danger_in_Benagil_Beach,_Algarve,_Portugal.jpg", alt: "Benagil beach exterior", width: 1920, height: 1280 },
      ],
      description: "A stunning sea cave with a natural skylight opening to the sky above a hidden beach — one of Portugal's most photographed natural wonders.",
      descriptionPt: "Uma deslumbrante gruta marinha com uma clarabóia natural que se abre para o céu sobre uma praia escondida — uma das maravilhas naturais mais fotografadas de Portugal.",
      descriptionDe: "Eine atemberaubende Meereshöhle mit einer natürlichen Öffnung zum Himmel über einem versteckten Strand — eines der meistfotografierten Naturwunder Portugals.",
      descriptionEs: "Una impresionante cueva marina con una claraboya natural que se abre al cielo sobre una playa escondida — una de las maravillas naturales más fotografiadas de Portugal.",
      descriptionFr: "Une superbe grotte marine avec une ouverture naturelle vers le ciel au-dessus d'une plage cachée — l'une des merveilles naturelles les plus photographiées du Portugal." },
    { name: "Ponta da Piedade", namePt: "Ponta da Piedade", nameDe: "Ponta da Piedade", nameEs: "Ponta da Piedade", nameFr: "Ponta da Piedade",
      description: "Dramatic golden sandstone cliffs, arches, and sea stacks rising from turquoise waters near Lagos — an unforgettable coastal backdrop.",
      descriptionPt: "Falésias dramáticas de arenito dourado, arcos e pilares marinhos que se erguem das águas turquesa perto de Lagos — um cenário costeiro inesquecível.",
      descriptionDe: "Eindrucksvolle goldene Sandsteinklippen, Bögen und Felsnadeln, die nahe Lagos aus türkisfarbenem Wasser ragen — eine unvergessliche Küstenkulisse.",
      descriptionEs: "Espectaculares acantilados de arenisca dorada, arcos y farallones marinos que se alzan sobre aguas turquesas cerca de Lagos — un escenario costero inolvidable.",
      descriptionFr: "De spectaculaires falaises de grès doré, des arches et des aiguilles rocheuses qui s'élèvent au-dessus des eaux turquoise près de Lagos — un décor côtier inoubliable." },
    { name: "Praia da Marinha", namePt: "Praia da Marinha", nameDe: "Praia da Marinha", nameEs: "Praia da Marinha", nameFr: "Praia da Marinha",
      description: "Consistently rated one of the most beautiful beaches in Europe, framed by sculpted limestone cliffs and crystal-clear water.",
      descriptionPt: "Classificada consistentemente como uma das praias mais bonitas da Europa, emoldurada por falésias calcárias esculpidas e água cristalina.",
      descriptionDe: "Wird durchgängig zu den schönsten Stränden Europas gezählt, eingerahmt von skulpturalen Kalksteinklippen und kristallklarem Wasser.",
      descriptionEs: "Calificada de forma constante como una de las playas más bellas de Europa, enmarcada por acantilados calcáreos esculpidos y aguas cristalinas.",
      descriptionFr: "Régulièrement classée parmi les plus belles plages d'Europe, encadrée de falaises calcaires sculptées et d'eaux cristallines." },
    { name: "Tavira Island", namePt: "Ilha de Tavira", nameDe: "Ilha de Tavira", nameEs: "Isla de Tavira", nameFr: "Île de Tavira",
      description: "A pristine barrier island in the Ria Formosa lagoon, accessible by ferry, with endless white sand and calm turquoise waters.",
      descriptionPt: "Uma ilha-barreira imaculada na Ria Formosa, acessível por ferry, com areia branca sem fim e águas turquesa calmas.",
      descriptionDe: "Eine unberührte Nehrungsinsel in der Lagune Ria Formosa, per Fähre erreichbar, mit endlosem weißem Sand und ruhigem türkisfarbenem Wasser.",
      descriptionEs: "Una isla barrera virgen en la laguna de Ria Formosa, accesible en ferry, con arena blanca infinita y aguas turquesas tranquilas.",
      descriptionFr: "Une île barrière préservée dans la lagune de la Ria Formosa, accessible en ferry, avec un sable blanc à perte de vue et des eaux turquoise paisibles." },
  ],
  lagos: [
    { name: "Ponta da Piedade", namePt: "Ponta da Piedade", nameEs: "Ponta da Piedade", nameFr: "Ponta da Piedade",
      description: "Towering sandstone pillars and sea grottos carved by the Atlantic, offering the most dramatic coastal scenery in the Algarve.",
      descriptionPt: "Imponentes pilares de arenito e grutas marinhas esculpidas pelo Atlântico, oferecendo o cenário costeiro mais dramático do Algarve.",
      descriptionEs: "Imponentes pilares de arenisca y grutas marinas talladas por el Atlántico, que ofrecen el paisaje costero más espectacular del Algarve.",
      descriptionFr: "D'imposants piliers de grès et des grottes marines sculptés par l'Atlantique, offrant le paysage côtier le plus saisissant de l'Algarve." },
    { name: "Praia do Camilo", namePt: "Praia do Camilo", nameEs: "Praia do Camilo", nameFr: "Praia do Camilo",
      description: "A small cove beach reached by a wooden staircase through the cliffs, creating an intimate and picturesque setting for portraits.",
      descriptionPt: "Uma pequena praia em enseada acedida por uma escadaria de madeira através das falésias, criando um cenário íntimo e pitoresco para retratos.",
      descriptionEs: "Una pequeña cala a la que se accede por una escalera de madera a través de los acantilados, creando un escenario íntimo y pintoresco para retratos.",
      descriptionFr: "Une petite crique accessible par un escalier en bois à travers les falaises, offrant un cadre intime et pittoresque pour les portraits." },
    { name: "Lagos Old Town", namePt: "Centro Histórico de Lagos", nameEs: "Casco Histórico de Lagos", nameFr: "Vieille ville de Lagos",
      description: "Charming streets within 16th-century walls filled with colorful buildings, lively plazas, and waterfront cafes perfect for lifestyle shots.",
      descriptionPt: "Ruas encantadoras dentro de muralhas do século XVI, com edifícios coloridos, praças animadas e cafés à beira-mar perfeitos para fotos de estilo de vida.",
      descriptionEs: "Encantadoras calles dentro de murallas del siglo XVI, llenas de edificios coloridos, plazas animadas y cafés frente al mar, perfectas para fotos de estilo de vida.",
      descriptionFr: "Des rues charmantes au sein de remparts du XVIe siècle, remplies de bâtiments colorés, de places animées et de cafés en bord de mer — parfaites pour des photos lifestyle." },
  ],
  cascais: [
    { name: "Boca do Inferno", namePt: "Boca do Inferno", nameEs: "Boca do Inferno", nameFr: "Boca do Inferno",
      description: "A dramatic chasm in the coastal cliffs where Atlantic waves crash with spectacular force — raw, powerful, and unforgettable.",
      descriptionPt: "Um abismo dramático nas falésias costeiras onde as ondas do Atlântico embatem com força espectacular — bruto, poderoso e inesquecível.",
      descriptionEs: "Un dramático abismo en los acantilados costeros donde las olas del Atlántico rompen con fuerza espectacular — bruto, poderoso e inolvidable.",
      descriptionFr: "Un gouffre spectaculaire dans les falaises côtières où les vagues de l'Atlantique s'écrasent avec une force impressionnante — brut, puissant et inoubliable." },
    { name: "Cascais Marina", namePt: "Marina de Cascais", nameEs: "Marina de Cascais", nameFr: "Marina de Cascais",
      description: "A sleek, modern marina surrounded by pastel-colored buildings and waterfront restaurants, blending seaside elegance with coastal charm.",
      descriptionPt: "Uma marina moderna e elegante rodeada por edifícios em tons pastel e restaurantes à beira-mar, unindo elegância à beira-mar e charme costeiro.",
      descriptionEs: "Una marina moderna y elegante rodeada de edificios en tonos pastel y restaurantes frente al mar, que combina elegancia y encanto costero.",
      descriptionFr: "Une marina moderne et élégante entourée de bâtiments aux tons pastel et de restaurants en bord de mer, alliant élégance balnéaire et charme côtier." },
    { name: "Casa de Santa Maria", namePt: "Casa de Santa Maria", nameEs: "Casa de Santa Maria", nameFr: "Casa de Santa Maria",
      description: "A beautifully restored aristocratic mansion on the waterfront with ornate tile work, arched windows, and ocean views.",
      descriptionPt: "Uma mansão aristocrática lindamente restaurada à beira-mar, com azulejos ornamentados, janelas em arco e vistas para o oceano.",
      descriptionEs: "Una mansión aristocrática bellamente restaurada frente al mar, con azulejos ornamentados, ventanas en arco y vistas al océano.",
      descriptionFr: "Une demeure aristocratique magnifiquement restaurée en bord de mer, avec des azulejos ornés, des fenêtres en arc et des vues sur l'océan." },
  ],
  madeira: [
    { name: "Cabo Girao", namePt: "Cabo Girão", nameDe: "Cabo Girão", nameEs: "Cabo Girão", nameFr: "Cabo Girão",
      description: "Europe's highest sea cliff at 580 meters, with a glass-floor skywalk offering vertigo-inducing views over the Atlantic Ocean.",
      descriptionPt: "A falésia marítima mais alta da Europa, com 580 metros, com um miradouro de piso de vidro que oferece vistas vertiginosas sobre o Oceano Atlântico.",
      descriptionDe: "Mit 580 Metern Europas höchste Steilküste, mit einem Skywalk aus Glas, der schwindelerregende Blicke auf den Atlantik bietet.",
      descriptionEs: "El acantilado marino más alto de Europa, con 580 metros, con un mirador de suelo de cristal que ofrece vistas vertiginosas sobre el océano Atlántico.",
      descriptionFr: "La plus haute falaise maritime d'Europe, à 580 mètres, avec une passerelle au sol de verre offrant des vues vertigineuses sur l'océan Atlantique." },
    { name: "Funchal Old Town", namePt: "Zona Velha do Funchal", nameDe: "Altstadt von Funchal", nameEs: "Casco Antiguo de Funchal", nameFr: "Vieille ville de Funchal",
      description: "Vibrant painted doors, flower-lined streets, and colorful markets make this historic district a photographer's playground.",
      descriptionPt: "Portas pintadas vibrantes, ruas floridas e mercados coloridos fazem deste bairro histórico um paraíso para fotógrafos.",
      descriptionDe: "Bunt bemalte Türen, blumengesäumte Gassen und farbenfrohe Märkte machen dieses historische Viertel zum Spielplatz jedes Fotografen.",
      descriptionEs: "Puertas pintadas vibrantes, calles llenas de flores y mercados coloridos hacen de este barrio histórico un paraíso para fotógrafos.",
      descriptionFr: "Des portes peintes éclatantes, des rues bordées de fleurs et des marchés colorés font de ce quartier historique un terrain de jeu pour les photographes." },
    { name: "Levada Walks", namePt: "Levadas", nameDe: "Levada-Wanderwege", nameEs: "Senderos de las Levadas", nameFr: "Sentiers des Levadas",
      description: "Ancient irrigation channel trails through lush laurel forests and misty mountains — perfect for adventurous, nature-immersed photoshoots.",
      descriptionPt: "Antigos canais de irrigação que atravessam florestas de laurissilva e montanhas enevoadas — perfeitos para sessões fotográficas aventureiras imersas na natureza.",
      descriptionDe: "Uralte Bewässerungskanäle führen durch üppige Lorbeerwälder und neblige Berge — perfekt für abenteuerliche, naturnahe Fotoshootings.",
      descriptionEs: "Antiguos senderos de canales de irrigación a través de exuberantes bosques de laurisilva y montañas brumosas — perfectos para sesiones fotográficas aventureras inmersas en la naturaleza.",
      descriptionFr: "D'anciens sentiers de canaux d'irrigation traversant de luxuriantes forêts de lauriers et des montagnes brumeuses — parfaits pour des séances photo aventureuses au cœur de la nature." },
  ],
  azores: [
    { name: "Sete Cidades", namePt: "Sete Cidades", nameDe: "Sete Cidades", nameEs: "Sete Cidades", nameFr: "Sete Cidades",
      description: "Twin crater lakes — one green, one blue — nestled inside a volcanic caldera, creating one of the most surreal landscapes in Europe.",
      descriptionPt: "Lagoas gémeas — uma verde, outra azul — dentro de uma caldeira vulcânica, criando uma das paisagens mais surreais da Europa.",
      descriptionDe: "Zwillings-Kraterseen — einer grün, einer blau — eingebettet in einer vulkanischen Caldera, eine der surrealsten Landschaften Europas.",
      descriptionEs: "Lagunas gemelas en un cráter — una verde, otra azul — enclavadas en una caldera volcánica, creando uno de los paisajes más surrealistas de Europa.",
      descriptionFr: "Des lacs jumeaux dans un cratère — l'un vert, l'autre bleu — nichés au sein d'une caldeira volcanique, formant l'un des paysages les plus surréalistes d'Europe." },
    { name: "Furnas", namePt: "Furnas", nameDe: "Furnas", nameEs: "Furnas", nameFr: "Furnas",
      description: "A volcanic valley of steaming fumaroles, thermal hot springs, and lush botanical gardens with an otherworldly atmosphere.",
      descriptionPt: "Um vale vulcânico com fumarolas, nascentes termais e exuberantes jardins botânicos, com uma atmosfera de outro mundo.",
      descriptionDe: "Ein vulkanisches Tal mit dampfenden Fumarolen, heißen Thermalquellen und üppigen botanischen Gärten — eine Atmosphäre wie aus einer anderen Welt.",
      descriptionEs: "Un valle volcánico con fumarolas humeantes, fuentes termales y exuberantes jardines botánicos, con una atmósfera de otro mundo.",
      descriptionFr: "Une vallée volcanique parsemée de fumerolles fumantes, de sources thermales chaudes et de jardins botaniques luxuriants, avec une atmosphère surnaturelle." },
    { name: "Lagoa do Fogo", namePt: "Lagoa do Fogo", nameDe: "Lagoa do Fogo", nameEs: "Lagoa do Fogo", nameFr: "Lagoa do Fogo",
      description: "A pristine crater lake surrounded by untouched wilderness, often wrapped in dramatic clouds — raw and remote natural beauty.",
      descriptionPt: "Uma lagoa de cratera intocada, rodeada de natureza selvagem e frequentemente envolta em nuvens dramáticas — beleza natural bruta e remota.",
      descriptionDe: "Ein unberührter Kratersee inmitten urtümlicher Wildnis, oft in dramatische Wolken gehüllt — raue und abgelegene Naturschönheit.",
      descriptionEs: "Una laguna de cráter intacta rodeada de naturaleza virgen, a menudo envuelta en nubes dramáticas — belleza natural bruta y remota.",
      descriptionFr: "Un lac de cratère préservé entouré d'une nature sauvage intacte, souvent enveloppé de nuages spectaculaires — une beauté naturelle brute et lointaine." },
  ],
  caparica: [
    { name: "Praia da Fonte da Telha", namePt: "Praia da Fonte da Telha", nameEs: "Praia da Fonte da Telha", nameFr: "Praia da Fonte da Telha",
      description: "A wild, windswept stretch of golden sand backed by dramatic fossil cliffs, ideal for sunset and editorial-style shoots.",
      descriptionPt: "Uma faixa selvagem de areia dourada protegida por falésias fósseis dramáticas, ideal para sessões ao pôr do sol e de estilo editorial.",
      descriptionEs: "Una franja salvaje y azotada por el viento de arena dorada, respaldada por dramáticos acantilados fósiles, ideal para sesiones al atardecer y de estilo editorial.",
      descriptionFr: "Une étendue sauvage et venteuse de sable doré adossée à de spectaculaires falaises fossiles, idéale pour des séances au coucher du soleil et de style éditorial." },
    { name: "Costa da Caparica Beach", namePt: "Praia da Costa da Caparica", nameEs: "Playa de Costa da Caparica", nameFr: "Plage de Costa da Caparica",
      description: "A long, wide beach with a lively atmosphere and unobstructed Atlantic sunset views just across the river from Lisbon.",
      descriptionPt: "Uma praia longa e ampla com atmosfera animada e vistas desobstruídas do pôr do sol atlântico, a poucos minutos de Lisboa.",
      descriptionEs: "Una playa larga y amplia con un ambiente animado y vistas despejadas del atardecer atlántico, justo al otro lado del río desde Lisboa.",
      descriptionFr: "Une plage longue et large à l'atmosphère animée, avec une vue dégagée sur le coucher de soleil atlantique, juste de l'autre côté du fleuve face à Lisbonne." },
    { name: "Arriba Fossil", namePt: "Arriba Fóssil", nameEs: "Arriba Fóssil", nameFr: "Arriba Fóssil",
      description: "A protected fossilized clifftop landscape offering unique geological formations and panoramic coastal views.",
      descriptionPt: "Uma paisagem protegida de falésias fossilizadas com formações geológicas únicas e vistas panorâmicas da costa.",
      descriptionEs: "Un paisaje protegido de acantilados fosilizados con formaciones geológicas únicas y vistas panorámicas de la costa.",
      descriptionFr: "Un paysage protégé de falaises fossilisées offrant des formations géologiques uniques et des vues panoramiques sur la côte." },
  ],
  setubal: [
    { name: "Arrabida Natural Park", namePt: "Parque Natural da Arrábida", nameEs: "Parque Natural de la Arrábida", nameFr: "Parc naturel de l'Arrábida",
      description: "Towering limestone cliffs plunging into crystal-clear turquoise coves, surrounded by lush Mediterranean vegetation.",
      descriptionPt: "Imponentes falésias calcárias que mergulham em enseadas turquesa cristalinas, rodeadas de exuberante vegetação mediterrânica.",
      descriptionEs: "Imponentes acantilados calcáreos que se sumergen en calas turquesas cristalinas, rodeados de exuberante vegetación mediterránea.",
      descriptionFr: "D'imposantes falaises calcaires plongeant dans des criques turquoise cristallines, entourées d'une luxuriante végétation méditerranéenne." },
    { name: "Troia Peninsula", namePt: "Península de Tróia", nameEs: "Península de Tróia", nameFr: "Péninsule de Tróia",
      description: "Endless white sand beaches stretching along the Sado Estuary, with calm waters and a tranquil, unspoiled atmosphere.",
      descriptionPt: "Praias infindáveis de areia branca ao longo do Estuário do Sado, com águas calmas e uma atmosfera tranquila e preservada.",
      descriptionEs: "Interminables playas de arena blanca a lo largo del estuario del Sado, con aguas tranquilas y una atmósfera serena y preservada.",
      descriptionFr: "Des plages de sable blanc à perte de vue le long de l'estuaire du Sado, avec des eaux calmes et une atmosphère paisible et préservée." },
    { name: "Setubal Harbor", namePt: "Porto de Setúbal", nameEs: "Puerto de Setúbal", nameFr: "Port de Setúbal",
      description: "A working fishing port with colorful boats and an authentic, gritty charm that captures real Portuguese coastal life.",
      descriptionPt: "Um porto de pesca ativo com barcos coloridos e um charme autêntico que capta a verdadeira vida costeira portuguesa.",
      descriptionEs: "Un puerto pesquero en activo con barcos coloridos y un encanto auténtico y rudo que captura la verdadera vida costera portuguesa.",
      descriptionFr: "Un port de pêche en activité avec des bateaux colorés et un charme authentique et brut qui capture la vraie vie côtière portugaise." },
  ],
  comporta: [
    { name: "Comporta Beach", namePt: "Praia da Comporta", nameEs: "Praia da Comporta", nameFr: "Plage de Comporta",
      description: "Pristine white sand backed by umbrella pines, with a bohemian luxury vibe favored by artists and creatives.",
      descriptionPt: "Areia branca imaculada rodeada de pinheiros-mansos, com um ambiente de luxo boémio apreciado por artistas e criativos.",
      descriptionEs: "Arena blanca virgen rodeada de pinos piñoneros, con un ambiente de lujo bohemio apreciado por artistas y creativos.",
      descriptionFr: "Un sable blanc immaculé bordé de pins parasols, avec une ambiance de luxe bohème prisée des artistes et créatifs." },
    { name: "Rice Paddies", namePt: "Arrozais", nameEs: "Arrozales", nameFr: "Rizières",
      description: "Vast flooded rice fields reflecting the sky, dotted with storks — a uniquely serene and minimalist landscape.",
      descriptionPt: "Vastos arrozais inundados que refletem o céu, pontuados por cegonhas — uma paisagem serena e minimalista única.",
      descriptionEs: "Vastos arrozales inundados que reflejan el cielo, salpicados de cigüeñas — un paisaje único, sereno y minimalista.",
      descriptionFr: "De vastes rizières inondées qui reflètent le ciel, parsemées de cigognes — un paysage à la fois serein et minimaliste, unique en son genre." },
    { name: "Carvalhal Beach", namePt: "Praia do Carvalhal", nameEs: "Praia do Carvalhal", nameFr: "Plage de Carvalhal",
      description: "A quieter stretch with rustic wooden beach restaurants and golden dunes, perfect for relaxed golden-hour sessions.",
      descriptionPt: "Uma faixa mais tranquila com restaurantes de praia rústicos em madeira e dunas douradas, perfeita para sessões descontraídas ao pôr do sol.",
      descriptionEs: "Un tramo más tranquilo con rústicos restaurantes de playa de madera y dunas doradas, perfecto para sesiones relajadas a la hora dorada.",
      descriptionFr: "Une étendue plus paisible avec des restaurants de plage rustiques en bois et des dunes dorées, parfaite pour des séances détendues à l'heure dorée." },
  ],
  guimaraes: [
    { name: "Guimaraes Castle", namePt: "Castelo de Guimarães", nameEs: "Castillo de Guimarães", nameFr: "Château de Guimarães",
      description: "The 10th-century castle where Portugal was born, with imposing stone towers and sweeping hilltop views over the city.",
      descriptionPt: "O castelo do século X onde Portugal nasceu, com imponentes torres de pedra e amplas vistas do topo da colina sobre a cidade.",
      descriptionEs: "El castillo del siglo X donde nació Portugal, con imponentes torres de piedra y amplias vistas desde lo alto de la colina sobre la ciudad.",
      descriptionFr: "Le château du Xe siècle où le Portugal est né, avec ses imposantes tours de pierre et de vastes vues du sommet de la colline sur la ville." },
    { name: "Largo da Oliveira", namePt: "Largo da Oliveira", nameEs: "Largo da Oliveira", nameFr: "Largo da Oliveira",
      description: "A charming medieval square lined with granite buildings, outdoor cafes, and a 14th-century Gothic canopy shrine.",
      descriptionPt: "Uma encantadora praça medieval ladeada por edifícios em granito, cafés ao ar livre e um padrão gótico do século XIV.",
      descriptionEs: "Una encantadora plaza medieval flanqueada por edificios de granito, cafés al aire libre y un templete gótico del siglo XIV.",
      descriptionFr: "Une charmante place médiévale bordée de bâtiments en granit, de cafés en terrasse et d'un édicule gothique du XIVe siècle." },
    { name: "Palace of the Dukes of Braganza", namePt: "Paço dos Duques de Bragança", nameEs: "Palacio de los Duques de Braganza", nameFr: "Palais des ducs de Bragance",
      description: "A grand 15th-century palace with a distinctive roofline of 39 brick chimneys, set in manicured gardens.",
      descriptionPt: "Um grande palácio do século XV com um telhado característico de 39 chaminés de tijolo, rodeado de jardins bem cuidados.",
      descriptionEs: "Un grandioso palacio del siglo XV con un tejado distintivo de 39 chimeneas de ladrillo, rodeado de jardines bien cuidados.",
      descriptionFr: "Un grand palais du XVe siècle avec une toiture distinctive de 39 cheminées en brique, niché dans des jardins soigneusement entretenus." },
  ],
  braga: [
    { name: "Bom Jesus do Monte", namePt: "Bom Jesus do Monte", nameEs: "Bom Jesus do Monte", nameFr: "Bom Jesus do Monte",
      description: "A monumental baroque stairway of 577 steps flanked by ornate fountains, leading to a hilltop church with panoramic views.",
      descriptionPt: "Uma monumental escadaria barroca de 577 degraus ladeada por fontes ornamentadas, que conduz a uma igreja no topo da colina com vistas panorâmicas.",
      descriptionEs: "Una monumental escalinata barroca de 577 escalones flanqueada por fuentes ornamentadas, que conduce a una iglesia en lo alto de la colina con vistas panorámicas.",
      descriptionFr: "Un escalier baroque monumental de 577 marches flanqué de fontaines ornées, menant à une église au sommet de la colline avec vue panoramique." },
    { name: "Braga Cathedral", namePt: "Sé de Braga", nameEs: "Catedral de Braga", nameFr: "Cathédrale de Braga",
      description: "The oldest cathedral in Portugal, blending Romanesque, Gothic, and Baroque styles in the heart of the historic center.",
      descriptionPt: "A mais antiga catedral de Portugal, combinando estilos românico, gótico e barroco no coração do centro histórico.",
      descriptionEs: "La catedral más antigua de Portugal, que combina estilos románico, gótico y barroco en el corazón del centro histórico.",
      descriptionFr: "La plus ancienne cathédrale du Portugal, mêlant les styles roman, gothique et baroque au cœur du centre historique." },
    { name: "Jardim de Santa Barbara", namePt: "Jardim de Santa Bárbara", nameEs: "Jardim de Santa Bárbara", nameFr: "Jardim de Santa Bárbara",
      description: "A beautifully manicured formal garden beside the medieval Archbishop's Palace, bursting with color year-round.",
      descriptionPt: "Um jardim formal lindamente cuidado junto ao medieval Paço Arquiepiscopal, cheio de cor todo o ano.",
      descriptionEs: "Un jardín formal bellamente cuidado junto al medieval Palacio Arzobispal, lleno de color todo el año.",
      descriptionFr: "Un jardin à la française magnifiquement entretenu à côté du Palais archiépiscopal médiéval, débordant de couleurs toute l'année." },
  ],
  "douro-valley": [
    { name: "Pinhao", namePt: "Pinhão", nameEs: "Pinhão", nameFr: "Pinhão",
      description: "A riverside village at the heart of port wine country, with a tile-decorated train station and vine-covered hillsides.",
      descriptionPt: "Uma aldeia ribeirinha no coração da região do Vinho do Porto, com uma estação ferroviária decorada com azulejos e encostas cobertas de vinhas.",
      descriptionEs: "Un pueblo ribereño en el corazón de la región del vino de Oporto, con una estación de tren decorada con azulejos y laderas cubiertas de viñedos.",
      descriptionFr: "Un village au bord du fleuve, au cœur du pays du vin de Porto, avec une gare ornée d'azulejos et des coteaux couverts de vignes." },
    { name: "Miradouro de Sao Leonardo de Galafura", namePt: "Miradouro de São Leonardo de Galafura", nameEs: "Miradouro de São Leonardo de Galafura", nameFr: "Miradouro de São Leonardo de Galafura",
      description: "A panoramic viewpoint overlooking the terraced vineyards of the Douro, famously described as the most beautiful view in Portugal.",
      descriptionPt: "Um miradouro panorâmico sobre os vinhedos em socalcos do Douro, famosamente descrito como a vista mais bonita de Portugal.",
      descriptionEs: "Un mirador panorámico sobre los viñedos en terrazas del Duero, célebremente descrito como la vista más hermosa de Portugal.",
      descriptionFr: "Un belvédère panoramique surplombant les vignobles en terrasses du Douro, célèbre pour être décrit comme la plus belle vue du Portugal." },
    { name: "Quinta da Roeda", namePt: "Quinta da Roeda", nameEs: "Quinta da Roeda", nameFr: "Quinta da Roeda",
      description: "A historic wine estate with terraced vineyards plunging toward the river, offering an authentic wine country backdrop.",
      descriptionPt: "Uma histórica quinta vinícola com vinhedos em socalcos que mergulham em direção ao rio, oferecendo um cenário autêntico da região vinhateira.",
      descriptionEs: "Una histórica finca vinícola con viñedos en terrazas que descienden hacia el río, ofreciendo un escenario auténtico de la región vinícola.",
      descriptionFr: "Un domaine viticole historique avec des vignobles en terrasses qui descendent vers le fleuve, offrant un décor authentique de pays vinicole." },
  ],
  aveiro: [
    { name: "Central Canal", namePt: "Canal Central", nameEs: "Canal Central", nameFr: "Canal Central",
      description: "Colorful moliceiro boats glide along the canal lined with Art Nouveau buildings — the quintessential Aveiro photo.",
      descriptionPt: "Coloridos barcos moliceiros deslizam pelo canal ladeado por edifícios Arte Nova — a fotografia clássica de Aveiro.",
      descriptionEs: "Coloridos barcos moliceiros se deslizan por el canal flanqueado por edificios modernistas — la fotografía por excelencia de Aveiro.",
      descriptionFr: "Des bateaux moliceiros colorés glissent le long du canal bordé d'immeubles Art nouveau — la photo emblématique d'Aveiro." },
    { name: "Costa Nova", namePt: "Costa Nova", nameEs: "Costa Nova", nameFr: "Costa Nova",
      description: "A beach village famous for its striped palheiros (wooden houses) painted in vivid candy-colored stripes.",
      descriptionPt: "Uma vila de praia famosa pelos seus palheiros às riscas, pintados em cores vivas e contrastantes.",
      descriptionEs: "Un pueblo de playa famoso por sus palheiros (casas de madera) pintadas con vivas rayas de colores caramelo.",
      descriptionFr: "Un village balnéaire célèbre pour ses palheiros (maisons en bois) peintes de rayures vives aux couleurs de bonbons." },
    { name: "Ria de Aveiro Lagoon", namePt: "Ria de Aveiro", nameEs: "Ría de Aveiro", nameFr: "Lagune de la Ria de Aveiro",
      description: "A vast, serene lagoon with salt flats, fishing boats, and soft golden light perfect for tranquil portraits.",
      descriptionPt: "Uma vasta e serena ria com salinas, barcos de pesca e uma luz dourada suave, perfeita para retratos tranquilos.",
      descriptionEs: "Una vasta y serena ría con salinas, barcos de pesca y una suave luz dorada perfecta para retratos tranquilos.",
      descriptionFr: "Une vaste lagune sereine avec des marais salants, des bateaux de pêche et une lumière dorée douce, parfaite pour des portraits paisibles." },
  ],
  geres: [
    { name: "Cascata do Tahiti", namePt: "Cascata do Tahiti", nameEs: "Cascata do Tahiti", nameFr: "Cascade do Tahiti",
      description: "A hidden waterfall cascading into an emerald pool surrounded by moss-covered rocks and ancient forest.",
      descriptionPt: "Uma cascata escondida que desce até uma poça esmeralda rodeada de rochas cobertas de musgo e floresta antiga.",
      descriptionEs: "Una cascada escondida que desciende hasta una poza esmeralda rodeada de rocas cubiertas de musgo y bosque antiguo.",
      descriptionFr: "Une cascade cachée qui se déverse dans un bassin émeraude entouré de rochers couverts de mousse et d'une forêt ancienne." },
    { name: "Canicada Reservoir", namePt: "Albufeira da Caniçada", nameEs: "Embalse de Caniçada", nameFr: "Réservoir de Caniçada",
      description: "A turquoise mountain lake surrounded by dense forest and granite peaks, offering dramatic nature backdrops.",
      descriptionPt: "Uma albufeira turquesa de montanha rodeada por floresta densa e picos graníticos, oferecendo cenários naturais dramáticos.",
      descriptionEs: "Un lago de montaña turquesa rodeado de bosque denso y picos graníticos, que ofrece dramáticos escenarios naturales.",
      descriptionFr: "Un lac de montagne turquoise entouré d'une forêt dense et de pics granitiques, offrant de spectaculaires décors naturels." },
    { name: "Lindoso Village", namePt: "Aldeia do Lindoso", nameEs: "Aldea de Lindoso", nameFr: "Village de Lindoso",
      description: "An ancient granite village with a hilltop castle and traditional espigueiros (stone granaries) set against wild mountain scenery.",
      descriptionPt: "Uma antiga aldeia de granito com castelo no topo da colina e tradicionais espigueiros, enquadrada por paisagem montanhosa selvagem.",
      descriptionEs: "Una antigua aldea de granito con un castillo en lo alto de la colina y tradicionales espigueiros (graneros de piedra), enmarcada por un paisaje montañoso salvaje.",
      descriptionFr: "Un ancien village de granit avec un château au sommet de la colline et des espigueiros traditionnels (greniers en pierre), sur fond de paysage montagneux sauvage." },
  ],
  tomar: [
    { name: "Convent of Christ", namePt: "Convento de Cristo", nameEs: "Convento de Cristo", nameFr: "Couvent du Christ",
      description: "A UNESCO World Heritage Templar fortress with one of the most ornate Manueline windows in Portugal.",
      descriptionPt: "Uma fortaleza templária, Património Mundial da UNESCO, com uma das mais ornamentadas janelas manuelinas de Portugal.",
      descriptionEs: "Una fortaleza templaria, Patrimonio de la Humanidad de la UNESCO, con una de las ventanas manuelinas más ornamentadas de Portugal.",
      descriptionFr: "Une forteresse templière classée au patrimoine mondial de l'UNESCO, avec l'une des fenêtres manuélines les plus ornées du Portugal." },
    { name: "Nabao River Gardens", namePt: "Jardins do Rio Nabão", nameEs: "Jardines del Río Nabão", nameFr: "Jardins du Nabão",
      description: "Lush riverside gardens and tree-lined walkways along the Nabao River, offering a peaceful and romantic setting.",
      descriptionPt: "Jardins ribeirinhos exuberantes e passeios arborizados ao longo do Rio Nabão, oferecendo um ambiente pacífico e romântico.",
      descriptionEs: "Exuberantes jardines ribereños y paseos arbolados a lo largo del río Nabão, que ofrecen un entorno pacífico y romántico.",
      descriptionFr: "De luxuriants jardins en bord de fleuve et des allées arborées le long du Nabão, offrant un cadre paisible et romantique." },
    { name: "Mata Nacional dos Sete Montes", namePt: "Mata Nacional dos Sete Montes", nameEs: "Mata Nacional dos Sete Montes", nameFr: "Mata Nacional dos Sete Montes",
      description: "A large forested park adjacent to the castle, with shaded paths, ancient trees, and hidden corners.",
      descriptionPt: "Um grande parque arborizado junto ao castelo, com caminhos sombreados, árvores centenárias e recantos escondidos.",
      descriptionEs: "Un gran parque arbolado junto al castillo, con senderos sombreados, árboles centenarios y rincones escondidos.",
      descriptionFr: "Un grand parc boisé attenant au château, avec des sentiers ombragés, des arbres centenaires et des recoins cachés." },
  ],
  peniche: [
    { name: "Cabo Carvoeiro", namePt: "Cabo Carvoeiro", nameEs: "Cabo Carvoeiro", nameFr: "Cabo Carvoeiro",
      description: "A dramatic clifftop lighthouse at the western tip of the Peniche peninsula, with sweeping Atlantic panoramas.",
      descriptionPt: "Um farol dramático no topo da falésia, no extremo ocidental da península de Peniche, com amplas panorâmicas atlânticas.",
      descriptionEs: "Un dramático faro en lo alto del acantilado, en el extremo occidental de la península de Peniche, con amplias panorámicas atlánticas.",
      descriptionFr: "Un phare spectaculaire au sommet de la falaise, à la pointe ouest de la péninsule de Peniche, avec de vastes panoramas atlantiques." },
    { name: "Supertubos Beach", namePt: "Praia dos Supertubos", nameEs: "Praia dos Supertubos", nameFr: "Plage de Supertubos",
      description: "A world-famous surf break with powerful waves and wide golden sand, ideal for dynamic action-style shoots.",
      descriptionPt: "Uma praia de surf mundialmente famosa com ondas potentes e vasta areia dourada, ideal para sessões dinâmicas e de ação.",
      descriptionEs: "Una rompiente de surf mundialmente famosa con olas potentes y amplia arena dorada, ideal para sesiones dinámicas y de acción.",
      descriptionFr: "Un spot de surf de renommée mondiale avec des vagues puissantes et un large sable doré, idéal pour des séances dynamiques et d'action." },
    { name: "Berlengas Islands", namePt: "Ilhas Berlengas", nameEs: "Islas Berlengas", nameFr: "Îles Berlengas",
      description: "A nature reserve archipelago with crystal-clear waters and a 17th-century island fortress, accessible by boat.",
      descriptionPt: "Um arquipélago de reserva natural com águas cristalinas e uma fortaleza do século XVII, acessível de barco.",
      descriptionEs: "Un archipiélago de reserva natural con aguas cristalinas y una fortaleza insular del siglo XVII, accesible en barco.",
      descriptionFr: "Un archipel classé réserve naturelle avec des eaux cristallines et une forteresse insulaire du XVIIe siècle, accessible en bateau." },
  ],
  coimbra: [
    { name: "Joanina Library", namePt: "Biblioteca Joanina", nameEs: "Biblioteca Joanina", nameFr: "Bibliothèque Joanine",
      description: "A jaw-dropping baroque library at the University of Coimbra, with gilded bookshelves and painted ceilings.",
      descriptionPt: "Uma deslumbrante biblioteca barroca da Universidade de Coimbra, com estantes douradas e tetos pintados.",
      descriptionEs: "Una impresionante biblioteca barroca de la Universidad de Coímbra, con estanterías doradas y techos pintados.",
      descriptionFr: "Une bibliothèque baroque époustouflante à l'Université de Coimbra, avec des étagères dorées et des plafonds peints." },
    { name: "University Tower", namePt: "Torre da Universidade", nameEs: "Torre de la Universidad", nameFr: "Tour de l'Université",
      description: "The hilltop university campus offers panoramic views over the Mondego River and the old town's red rooftops.",
      descriptionPt: "O campus universitário no topo da colina oferece vistas panorâmicas sobre o Rio Mondego e os telhados vermelhos da baixa.",
      descriptionEs: "El campus universitario en lo alto de la colina ofrece vistas panorámicas sobre el río Mondego y los tejados rojos del casco antiguo.",
      descriptionFr: "Le campus universitaire au sommet de la colline offre des vues panoramiques sur le Mondego et les toits rouges de la vieille ville." },
    { name: "Quinta das Lagrimas", namePt: "Quinta das Lágrimas", nameEs: "Quinta das Lágrimas", nameFr: "Quinta das Lágrimas",
      description: "A romantic garden estate linked to the tragic medieval love story of Pedro and Ines de Castro.",
      descriptionPt: "Uma romântica quinta ligada à trágica história de amor medieval de D. Pedro e Inês de Castro.",
      descriptionEs: "Una romántica finca con jardines vinculada a la trágica historia de amor medieval de Don Pedro e Inés de Castro.",
      descriptionFr: "Un domaine romantique aux jardins liés à la tragique histoire d'amour médiévale de Pierre et Inês de Castro." },
  ],
  obidos: [
    { name: "Castle Walls", namePt: "Muralhas do Castelo", nameEs: "Murallas del Castillo", nameFr: "Remparts du château",
      description: "Walk along the medieval ramparts for panoramic views over whitewashed houses, terracotta roofs, and the surrounding countryside.",
      descriptionPt: "Percorra as muralhas medievais para vistas panorâmicas sobre as casas caiadas de branco, telhados de terracota e a paisagem envolvente.",
      descriptionEs: "Recorra las murallas medievales para disfrutar de vistas panorámicas sobre casas encaladas, tejados de terracota y el paisaje circundante.",
      descriptionFr: "Parcourez les remparts médiévaux pour profiter de vues panoramiques sur les maisons blanchies à la chaux, les toits en terre cuite et la campagne environnante." },
    { name: "Rua Direita", namePt: "Rua Direita", nameEs: "Rua Direita", nameFr: "Rua Direita",
      description: "The main cobblestone street lined with whitewashed houses adorned with bougainvillea and hand-painted ceramics.",
      descriptionPt: "A rua principal, em calçada portuguesa, ladeada por casas brancas decoradas com buganvílias e cerâmica pintada à mão.",
      descriptionEs: "La calle principal empedrada, flanqueada por casas encaladas adornadas con buganvillas y cerámica pintada a mano.",
      descriptionFr: "La rue principale pavée, bordée de maisons blanchies à la chaux ornées de bougainvilliers et de céramiques peintes à la main." },
    { name: "Porta da Vila", namePt: "Porta da Vila", nameEs: "Porta da Vila", nameFr: "Porta da Vila",
      description: "The main town gate decorated with blue-and-white azulejo tiles, framing the entrance to the medieval walled town.",
      descriptionPt: "A porta principal da vila, decorada com azulejos azuis e brancos, a emoldurar a entrada da vila muralhada medieval.",
      descriptionEs: "La puerta principal del pueblo, decorada con azulejos azules y blancos, que enmarca la entrada a la villa amurallada medieval.",
      descriptionFr: "La porte principale de la ville, décorée d'azulejos bleus et blancs, encadrant l'entrée de la cité médiévale fortifiée." },
  ],
  nazare: [
    { name: "Farol da Nazare", namePt: "Farol da Nazaré", nameEs: "Faro de Nazaré", nameFr: "Phare de Nazaré",
      description: "The iconic lighthouse and cliff-edge viewpoint where spectators watch the world's biggest waves crash below.",
      descriptionPt: "O icónico farol e miradouro à beira da falésia, onde se assiste ao embate das maiores ondas do mundo.",
      descriptionEs: "El icónico faro y mirador al borde del acantilado, donde los espectadores observan cómo rompen abajo las olas más grandes del mundo.",
      descriptionFr: "L'emblématique phare et belvédère en bord de falaise, d'où les spectateurs observent les plus grosses vagues du monde s'écraser en contrebas." },
    { name: "Sitio", namePt: "Sítio", nameEs: "Sítio", nameFr: "Sítio",
      description: "The historic clifftop quarter with a fortress, churches, and dramatic panoramic views over the beach and Atlantic.",
      descriptionPt: "O histórico bairro no topo da falésia, com fortaleza, igrejas e vistas panorâmicas dramáticas sobre a praia e o Atlântico.",
      descriptionEs: "El histórico barrio en lo alto del acantilado, con fortaleza, iglesias y dramáticas vistas panorámicas sobre la playa y el Atlántico.",
      descriptionFr: "Le quartier historique au sommet de la falaise, avec sa forteresse, ses églises et de spectaculaires vues panoramiques sur la plage et l'Atlantique." },
    { name: "Praia da Nazare", namePt: "Praia da Nazaré", nameEs: "Praia da Nazaré", nameFr: "Praia da Nazaré",
      description: "The wide main beach with colorful traditional fishing boats and women in traditional seven-skirt costumes.",
      descriptionPt: "A ampla praia principal com coloridos barcos de pesca tradicionais e mulheres em trajes tradicionais de sete saias.",
      descriptionEs: "La amplia playa principal con coloridos barcos de pesca tradicionales y mujeres con los trajes tradicionales de siete faldas.",
      descriptionFr: "La grande plage principale avec ses bateaux de pêche traditionnels colorés et ses femmes en costume traditionnel aux sept jupes." },
  ],
  evora: [
    { name: "Temple of Diana", namePt: "Templo de Diana", nameEs: "Templo de Diana", nameFr: "Temple de Diane",
      description: "A remarkably preserved 2,000-year-old Roman temple in the heart of the city, surrounded by medieval architecture.",
      descriptionPt: "Um templo romano de 2000 anos notavelmente preservado no centro da cidade, rodeado de arquitetura medieval.",
      descriptionEs: "Un templo romano de 2000 años notablemente conservado en el corazón de la ciudad, rodeado de arquitectura medieval.",
      descriptionFr: "Un temple romain vieux de 2 000 ans remarquablement préservé au cœur de la ville, entouré d'architecture médiévale." },
    { name: "Chapel of Bones", namePt: "Capela dos Ossos", nameEs: "Capilla de los Huesos", nameFr: "Chapelle des Os",
      description: "A hauntingly beautiful chapel lined with human bones and skulls, creating a uniquely dramatic and atmospheric backdrop.",
      descriptionPt: "Uma capela de beleza inquietante, revestida com ossos e crânios humanos, criando um cenário dramático e atmosférico único.",
      descriptionEs: "Una capilla de inquietante belleza, revestida de huesos y calaveras humanas, que crea un escenario dramático y atmosférico único.",
      descriptionFr: "Une chapelle d'une beauté troublante, tapissée d'ossements et de crânes humains, créant un décor dramatique et atmosphérique unique." },
    { name: "Evora Cathedral Rooftop", namePt: "Telhado da Sé de Évora", nameEs: "Tejado de la Catedral de Évora", nameFr: "Toit de la cathédrale d'Évora",
      description: "The Gothic cathedral rooftop terrace offers sweeping views over the Alentejo plains and the city's historic center.",
      descriptionPt: "O terraço do telhado da catedral gótica oferece vistas amplas sobre as planícies alentejanas e o centro histórico da cidade.",
      descriptionEs: "La terraza del tejado de la catedral gótica ofrece amplias vistas sobre las llanuras del Alentejo y el centro histórico de la ciudad.",
      descriptionFr: "La terrasse sur le toit de la cathédrale gothique offre de vastes vues sur les plaines de l'Alentejo et le centre historique de la ville." },
  ],
  tavira: [
    { name: "Roman Bridge", namePt: "Ponte Romana", nameEs: "Puente Romano", nameFr: "Pont romain",
      description: "An ancient seven-arched bridge spanning the Gilao River in the heart of town, framed by whitewashed buildings.",
      descriptionPt: "Uma antiga ponte de sete arcos sobre o Rio Gilão no centro da cidade, emoldurada por edifícios caiados de branco.",
      descriptionEs: "Un antiguo puente de siete arcos sobre el río Gilão en el corazón de la ciudad, enmarcado por edificios encalados.",
      descriptionFr: "Un ancien pont à sept arches enjambant le Gilão au cœur de la ville, encadré par des bâtiments blanchis à la chaux." },
    { name: "Ria Formosa Lagoon", namePt: "Ria Formosa", nameEs: "Ría Formosa", nameFr: "Lagune de la Ria Formosa",
      description: "A protected lagoon system with pristine barrier island beaches, tidal flats, and spectacular sunset views.",
      descriptionPt: "Um sistema lagunar protegido com praias imaculadas em ilhas-barreira, salinas e vistas espetaculares do pôr do sol.",
      descriptionEs: "Un sistema lagunar protegido con playas vírgenes en islas barrera, zonas de marea y espectaculares vistas del atardecer.",
      descriptionFr: "Un système lagunaire protégé avec des plages d'îles barrières préservées, des estrans et des couchers de soleil spectaculaires." },
    { name: "Tavira Castle", namePt: "Castelo de Tavira", nameEs: "Castillo de Tavira", nameFr: "Château de Tavira",
      description: "A hilltop Moorish castle ruin surrounded by gardens, offering panoramic views over the town's pyramid-roofed houses.",
      descriptionPt: "As ruínas de um castelo mourisco no topo da colina, rodeado de jardins, com vistas panorâmicas sobre as casas de telhado em pirâmide.",
      descriptionEs: "Las ruinas de un castillo moro en lo alto de la colina, rodeado de jardines, con vistas panorámicas sobre las casas de tejado piramidal de la ciudad.",
      descriptionFr: "Les ruines d'un château maure au sommet d'une colline, entourées de jardins, offrant des vues panoramiques sur les maisons aux toits pyramidaux de la ville." },
  ],
};

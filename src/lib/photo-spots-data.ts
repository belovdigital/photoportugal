export interface PhotoSpot {
  name: string;
  description: string;
  /** Portuguese translations; when absent, EN fallback is used on /pt. */
  namePt?: string;
  descriptionPt?: string;
  best_time?: string;
  best_timePt?: string;
  tips?: string;
  tipsPt?: string;
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
  return (photoSpots[citySlug] || []).find((s) => spotSlug(s.name) === slug);
}

/** Returns name/description in the requested locale, falling back to EN. */
export function spotLocalized(spot: PhotoSpot, locale: string) {
  const pt = locale === "pt";
  return {
    name: pt && spot.namePt ? spot.namePt : spot.name,
    description: pt && spot.descriptionPt ? spot.descriptionPt : spot.description,
    best_time: pt && spot.best_timePt ? spot.best_timePt : spot.best_time,
    tips: pt && spot.tipsPt ? spot.tipsPt : spot.tips,
  };
}

/** Top photography spots per location slug */
export const photoSpots: Record<string, PhotoSpot[]> = {
  lisbon: [
    { name: "Miradouro da Graca", namePt: "Miradouro da Graça",
      description: "One of Lisbon's most scenic viewpoints with panoramic views over the city rooftops and the Tagus River — perfect for golden hour portraits.",
      descriptionPt: "Um dos miradouros mais cénicos de Lisboa, com vistas panorâmicas sobre os telhados da cidade e o rio Tejo — perfeito para retratos ao pôr do sol." },
    { name: "Alfama", namePt: "Alfama",
      description: "The oldest neighborhood in Lisbon, with narrow cobblestone streets, colorful azulejo-tiled facades, and authentic Portuguese atmosphere.",
      descriptionPt: "O bairro mais antigo de Lisboa, com ruas estreitas de calçada, fachadas coloridas de azulejos e uma atmosfera autenticamente portuguesa." },
    { name: "Belem Tower", namePt: "Torre de Belém",
      description: "The iconic 16th-century riverside fortress and UNESCO World Heritage site, ideal for dramatic architectural backdrops.",
      descriptionPt: "A icónica fortaleza ribeirinha do século XVI, Património Mundial da UNESCO, ideal para cenários arquitetónicos dramáticos." },
    { name: "LX Factory", namePt: "LX Factory",
      description: "A trendy creative hub in a converted industrial complex, offering street art, vibrant murals, and an urban-cool photoshoot aesthetic.",
      descriptionPt: "Um polo criativo num antigo complexo industrial reconvertido, com street art, murais vibrantes e uma estética urbana para sessões fotográficas." },
    { name: "Praca do Comercio", namePt: "Praça do Comércio",
      description: "Lisbon's grand waterfront square with its striking yellow arcades and the Triumphal Arch — a wide-open, elegant setting for group and couple photos.",
      descriptionPt: "A grande praça ribeirinha de Lisboa, com os seus característicos arcos amarelos e o Arco da Rua Augusta — um cenário amplo e elegante para fotos de grupo e casal." },
  ],
  porto: [
    { name: "Ribeira", namePt: "Ribeira",
      description: "The colorful UNESCO-listed riverfront district with stacked houses cascading down to the Douro — Porto's most iconic photoshoot location.",
      descriptionPt: "O colorido bairro ribeirinho classificado pela UNESCO, com casas empilhadas em cascata até ao Douro — o local mais icónico do Porto para sessões fotográficas." },
    { name: "Dom Luis I Bridge", namePt: "Ponte Dom Luís I",
      description: "The double-deck iron bridge offers dramatic framing with the Douro River and both sides of the city stretching below.",
      descriptionPt: "A ponte de ferro de dois tabuleiros oferece um enquadramento dramático com o rio Douro e ambas as margens da cidade em baixo." },
    { name: "Livraria Lello", namePt: "Livraria Lello",
      description: "One of the world's most beautiful bookshops, with a stunning neo-Gothic interior and the famous crimson staircase.",
      descriptionPt: "Uma das livrarias mais bonitas do mundo, com um interior neogótico deslumbrante e a famosa escadaria vermelha." },
    { name: "Sao Bento Station", namePt: "Estação de São Bento",
      description: "A railway station adorned with over 20,000 hand-painted azulejo tiles depicting Portuguese history — a unique indoor backdrop.",
      descriptionPt: "Uma estação ferroviária decorada com mais de 20 000 azulejos pintados à mão que retratam a história portuguesa — um cenário interior único." },
    { name: "Serra do Pilar", namePt: "Serra do Pilar",
      description: "A hilltop viewpoint on the Vila Nova de Gaia side, offering the classic panoramic shot of Porto's skyline and the Douro River.",
      descriptionPt: "Um miradouro no topo da colina em Vila Nova de Gaia, oferecendo a vista panorâmica clássica do skyline do Porto e do rio Douro." },
  ],
  sintra: [
    { name: "Pena Palace", namePt: "Palácio da Pena",
      description: "A Romanticist castle in vivid red and yellow perched on a misty hilltop, surrounded by enchanted gardens — pure fairytale magic.",
      descriptionPt: "Um castelo romântico em vermelho e amarelo vivos, no topo de uma colina enevoada, rodeado por jardins encantados — pura magia de conto de fadas." },
    { name: "Quinta da Regaleira", namePt: "Quinta da Regaleira",
      description: "Mystical estate with the famous Initiation Well, underground tunnels, grottoes, and lush gardens that feel like a fantasy world.",
      descriptionPt: "Uma propriedade mística com o famoso Poço Iniciático, túneis subterrâneos, grutas e jardins exuberantes que parecem saídos de um mundo de fantasia." },
    { name: "National Palace", namePt: "Palácio Nacional de Sintra",
      description: "The medieval royal palace in the heart of Sintra village, with its distinctive twin conical chimneys and ornate Moorish interiors.",
      descriptionPt: "O palácio real medieval no centro de Sintra, com as suas distintivas chaminés cónicas gémeas e interiores ornamentados de influência mourisca." },
    { name: "Monserrate Palace", namePt: "Palácio de Monserrate",
      description: "An exotic 19th-century palace with Moorish, Gothic, and Indian influences, set in romantic botanical gardens with rare plant species.",
      descriptionPt: "Um palácio exótico do século XIX com influências mouriscas, góticas e indianas, rodeado de jardins botânicos românticos com espécies raras." },
  ],
  algarve: [
    { name: "Benagil Cave", namePt: "Gruta de Benagil",
      description: "A stunning sea cave with a natural skylight opening to the sky above a hidden beach — one of Portugal's most photographed natural wonders.",
      descriptionPt: "Uma deslumbrante gruta marinha com uma clarabóia natural que se abre para o céu sobre uma praia escondida — uma das maravilhas naturais mais fotografadas de Portugal." },
    { name: "Ponta da Piedade", namePt: "Ponta da Piedade",
      description: "Dramatic golden sandstone cliffs, arches, and sea stacks rising from turquoise waters near Lagos — an unforgettable coastal backdrop.",
      descriptionPt: "Falésias dramáticas de arenito dourado, arcos e pilares marinhos que se erguem das águas turquesa perto de Lagos — um cenário costeiro inesquecível." },
    { name: "Praia da Marinha", namePt: "Praia da Marinha",
      description: "Consistently rated one of the most beautiful beaches in Europe, framed by sculpted limestone cliffs and crystal-clear water.",
      descriptionPt: "Classificada consistentemente como uma das praias mais bonitas da Europa, emoldurada por falésias calcárias esculpidas e água cristalina." },
    { name: "Tavira Island", namePt: "Ilha de Tavira",
      description: "A pristine barrier island in the Ria Formosa lagoon, accessible by ferry, with endless white sand and calm turquoise waters.",
      descriptionPt: "Uma ilha-barreira imaculada na Ria Formosa, acessível por ferry, com areia branca sem fim e águas turquesa calmas." },
  ],
  lagos: [
    { name: "Ponta da Piedade", namePt: "Ponta da Piedade",
      description: "Towering sandstone pillars and sea grottos carved by the Atlantic, offering the most dramatic coastal scenery in the Algarve.",
      descriptionPt: "Imponentes pilares de arenito e grutas marinhas esculpidas pelo Atlântico, oferecendo o cenário costeiro mais dramático do Algarve." },
    { name: "Praia do Camilo", namePt: "Praia do Camilo",
      description: "A small cove beach reached by a wooden staircase through the cliffs, creating an intimate and picturesque setting for portraits.",
      descriptionPt: "Uma pequena praia em enseada acedida por uma escadaria de madeira através das falésias, criando um cenário íntimo e pitoresco para retratos." },
    { name: "Lagos Old Town", namePt: "Centro Histórico de Lagos",
      description: "Charming streets within 16th-century walls filled with colorful buildings, lively plazas, and waterfront cafes perfect for lifestyle shots.",
      descriptionPt: "Ruas encantadoras dentro de muralhas do século XVI, com edifícios coloridos, praças animadas e cafés à beira-mar perfeitos para fotos de estilo de vida." },
  ],
  cascais: [
    { name: "Boca do Inferno", namePt: "Boca do Inferno",
      description: "A dramatic chasm in the coastal cliffs where Atlantic waves crash with spectacular force — raw, powerful, and unforgettable.",
      descriptionPt: "Um abismo dramático nas falésias costeiras onde as ondas do Atlântico embatem com força espectacular — bruto, poderoso e inesquecível." },
    { name: "Cascais Marina", namePt: "Marina de Cascais",
      description: "A sleek, modern marina surrounded by pastel-colored buildings and waterfront restaurants, blending seaside elegance with coastal charm.",
      descriptionPt: "Uma marina moderna e elegante rodeada por edifícios em tons pastel e restaurantes à beira-mar, unindo elegância à beira-mar e charme costeiro." },
    { name: "Casa de Santa Maria", namePt: "Casa de Santa Maria",
      description: "A beautifully restored aristocratic mansion on the waterfront with ornate tile work, arched windows, and ocean views.",
      descriptionPt: "Uma mansão aristocrática lindamente restaurada à beira-mar, com azulejos ornamentados, janelas em arco e vistas para o oceano." },
  ],
  madeira: [
    { name: "Cabo Girao", namePt: "Cabo Girão",
      description: "Europe's highest sea cliff at 580 meters, with a glass-floor skywalk offering vertigo-inducing views over the Atlantic Ocean.",
      descriptionPt: "A falésia marítima mais alta da Europa, com 580 metros, com um miradouro de piso de vidro que oferece vistas vertiginosas sobre o Oceano Atlântico." },
    { name: "Funchal Old Town", namePt: "Zona Velha do Funchal",
      description: "Vibrant painted doors, flower-lined streets, and colorful markets make this historic district a photographer's playground.",
      descriptionPt: "Portas pintadas vibrantes, ruas floridas e mercados coloridos fazem deste bairro histórico um paraíso para fotógrafos." },
    { name: "Levada Walks", namePt: "Levadas",
      description: "Ancient irrigation channel trails through lush laurel forests and misty mountains — perfect for adventurous, nature-immersed photoshoots.",
      descriptionPt: "Antigos canais de irrigação que atravessam florestas de laurissilva e montanhas enevoadas — perfeitos para sessões fotográficas aventureiras imersas na natureza." },
  ],
  azores: [
    { name: "Sete Cidades", description: "Twin crater lakes — one green, one blue — nestled inside a volcanic caldera, creating one of the most surreal landscapes in Europe." },
    { name: "Furnas", description: "A volcanic valley of steaming fumaroles, thermal hot springs, and lush botanical gardens with an otherworldly atmosphere." },
    { name: "Lagoa do Fogo", description: "A pristine crater lake surrounded by untouched wilderness, often wrapped in dramatic clouds — raw and remote natural beauty." },
  ],
  caparica: [
    { name: "Praia da Fonte da Telha", description: "A wild, windswept stretch of golden sand backed by dramatic fossil cliffs, ideal for sunset and editorial-style shoots." },
    { name: "Costa da Caparica Beach", description: "A long, wide beach with a lively atmosphere and unobstructed Atlantic sunset views just across the river from Lisbon." },
    { name: "Arriba Fossil", description: "A protected fossilized clifftop landscape offering unique geological formations and panoramic coastal views." },
  ],
  setubal: [
    { name: "Arrabida Natural Park", description: "Towering limestone cliffs plunging into crystal-clear turquoise coves, surrounded by lush Mediterranean vegetation." },
    { name: "Troia Peninsula", description: "Endless white sand beaches stretching along the Sado Estuary, with calm waters and a tranquil, unspoiled atmosphere." },
    { name: "Setubal Harbor", description: "A working fishing port with colorful boats and an authentic, gritty charm that captures real Portuguese coastal life." },
  ],
  comporta: [
    { name: "Comporta Beach", description: "Pristine white sand backed by umbrella pines, with a bohemian luxury vibe favored by artists and creatives." },
    { name: "Rice Paddies", description: "Vast flooded rice fields reflecting the sky, dotted with storks — a uniquely serene and minimalist landscape." },
    { name: "Carvalhal Beach", description: "A quieter stretch with rustic wooden beach restaurants and golden dunes, perfect for relaxed golden-hour sessions." },
  ],
  guimaraes: [
    { name: "Guimaraes Castle", description: "The 10th-century castle where Portugal was born, with imposing stone towers and sweeping hilltop views over the city." },
    { name: "Largo da Oliveira", description: "A charming medieval square lined with granite buildings, outdoor cafes, and a 14th-century Gothic canopy shrine." },
    { name: "Palace of the Dukes of Braganza", description: "A grand 15th-century palace with a distinctive roofline of 39 brick chimneys, set in manicured gardens." },
  ],
  braga: [
    { name: "Bom Jesus do Monte", description: "A monumental baroque stairway of 577 steps flanked by ornate fountains, leading to a hilltop church with panoramic views." },
    { name: "Braga Cathedral", description: "The oldest cathedral in Portugal, blending Romanesque, Gothic, and Baroque styles in the heart of the historic center." },
    { name: "Jardim de Santa Barbara", description: "A beautifully manicured formal garden beside the medieval Archbishop's Palace, bursting with color year-round." },
  ],
  "douro-valley": [
    { name: "Pinhao", description: "A riverside village at the heart of port wine country, with a tile-decorated train station and vine-covered hillsides." },
    { name: "Miradouro de Sao Leonardo de Galafura", description: "A panoramic viewpoint overlooking the terraced vineyards of the Douro, famously described as the most beautiful view in Portugal." },
    { name: "Quinta da Roeda", description: "A historic wine estate with terraced vineyards plunging toward the river, offering an authentic wine country backdrop." },
  ],
  aveiro: [
    { name: "Central Canal", description: "Colorful moliceiro boats glide along the canal lined with Art Nouveau buildings — the quintessential Aveiro photo." },
    { name: "Costa Nova", description: "A beach village famous for its striped palheiros (wooden houses) painted in vivid candy-colored stripes." },
    { name: "Ria de Aveiro Lagoon", description: "A vast, serene lagoon with salt flats, fishing boats, and soft golden light perfect for tranquil portraits." },
  ],
  geres: [
    { name: "Cascata do Tahiti", description: "A hidden waterfall cascading into an emerald pool surrounded by moss-covered rocks and ancient forest." },
    { name: "Canicada Reservoir", description: "A turquoise mountain lake surrounded by dense forest and granite peaks, offering dramatic nature backdrops." },
    { name: "Lindoso Village", description: "An ancient granite village with a hilltop castle and traditional espigueiros (stone granaries) set against wild mountain scenery." },
  ],
  tomar: [
    { name: "Convent of Christ", description: "A UNESCO World Heritage Templar fortress with one of the most ornate Manueline windows in Portugal." },
    { name: "Nabao River Gardens", description: "Lush riverside gardens and tree-lined walkways along the Nabao River, offering a peaceful and romantic setting." },
    { name: "Mata Nacional dos Sete Montes", description: "A large forested park adjacent to the castle, with shaded paths, ancient trees, and hidden corners." },
  ],
  peniche: [
    { name: "Cabo Carvoeiro", description: "A dramatic clifftop lighthouse at the western tip of the Peniche peninsula, with sweeping Atlantic panoramas." },
    { name: "Supertubos Beach", description: "A world-famous surf break with powerful waves and wide golden sand, ideal for dynamic action-style shoots." },
    { name: "Berlengas Islands", description: "A nature reserve archipelago with crystal-clear waters and a 17th-century island fortress, accessible by boat." },
  ],
  coimbra: [
    { name: "Joanina Library", description: "A jaw-dropping baroque library at the University of Coimbra, with gilded bookshelves and painted ceilings." },
    { name: "University Tower", description: "The hilltop university campus offers panoramic views over the Mondego River and the old town's red rooftops." },
    { name: "Quinta das Lagrimas", description: "A romantic garden estate linked to the tragic medieval love story of Pedro and Ines de Castro." },
  ],
  obidos: [
    { name: "Castle Walls", description: "Walk along the medieval ramparts for panoramic views over whitewashed houses, terracotta roofs, and the surrounding countryside." },
    { name: "Rua Direita", description: "The main cobblestone street lined with whitewashed houses adorned with bougainvillea and hand-painted ceramics." },
    { name: "Porta da Vila", description: "The main town gate decorated with blue-and-white azulejo tiles, framing the entrance to the medieval walled town." },
  ],
  nazare: [
    { name: "Farol da Nazare", description: "The iconic lighthouse and cliff-edge viewpoint where spectators watch the world's biggest waves crash below." },
    { name: "Sitio", description: "The historic clifftop quarter with a fortress, churches, and dramatic panoramic views over the beach and Atlantic." },
    { name: "Praia da Nazare", description: "The wide main beach with colorful traditional fishing boats and women in traditional seven-skirt costumes." },
  ],
  evora: [
    { name: "Temple of Diana", description: "A remarkably preserved 2,000-year-old Roman temple in the heart of the city, surrounded by medieval architecture." },
    { name: "Chapel of Bones", description: "A hauntingly beautiful chapel lined with human bones and skulls, creating a uniquely dramatic and atmospheric backdrop." },
    { name: "Evora Cathedral Rooftop", description: "The Gothic cathedral rooftop terrace offers sweeping views over the Alentejo plains and the city's historic center." },
  ],
  tavira: [
    { name: "Roman Bridge", description: "An ancient seven-arched bridge spanning the Gilao River in the heart of town, framed by whitewashed buildings." },
    { name: "Ria Formosa Lagoon", description: "A protected lagoon system with pristine barrier island beaches, tidal flats, and spectacular sunset views." },
    { name: "Tavira Castle", description: "A hilltop Moorish castle ruin surrounded by gardens, offering panoramic views over the town's pyramid-roofed houses." },
  ],
};

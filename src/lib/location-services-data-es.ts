// GENERATED for the Spanish market from location-services-data.ts.
// Do not hand-edit for geography — re-run scripts/gen-es-datasets.mjs.
// Hand-written factual corrections live below the generated block and are
// preserved by the generator's caller.

export interface LocationService {
  /** Shoot-type slug matching shoot-types-data.ts (e.g. "couples", "family") */
  shootTypeSlug: string;
  /** Display label shown in the card heading */
  label: string;
  /** 2-3 sentence SEO description tailored to *this* city + service combo */
  description: string;
  description_pt?: string;
  description_de?: string;
  description_es?: string;
  description_fr?: string;
}

/** Pick localized service description, fallback to English. */
export function serviceDescription(s: LocationService, locale: string): string {
  const key = `description_${locale}` as keyof LocationService;
  return (s[key] as string | undefined) || s.description;
}

/**
 * City+service content for the top 8 locations.
 * Key = location slug, value = array of relevant service types.
 * Locations not listed here simply skip the section.
 */
export const locationServicesES: Record<string, LocationService[]> = {
  lisbon: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "Madrid's colorful streets, romantic viewpoints, and golden light make it Spain's most popular destination for couples photography. From La Latina's intimate alleyways to sweeping Tagus views, every corner tells a love story.",
      description_pt: "As ruas coloridas de Madrid, miradors românticos e a luz dourada fazem dela o destino mais popular de Espanha para fotografia de casais. Das ruelas íntimas de La Latina às vistas amplas sobre o Tejo, cada esquina conta uma história de amor.",
      description_de: "Madrids bunte Straßen, romantische Aussichtspunkte und goldenes Licht machen es zu Spaniens beliebtestem Ziel für Paar-Fotografie. Von La Latinas intimen Gassen bis zu weiten Tejo-Ausblicken erzählt jede Ecke eine Liebesgeschichte.",
      description_es: "Las calles coloridas de Madrid, los miradores románticos y la luz dorada la convierten en el destino más popular de España para fotografía de parejas. Desde los callejones íntimos de La Latina hasta las amplias vistas del Tajo, cada rincón cuenta una historia de amor.",
      description_fr: "Les rues colorées de Madrid, ses miradors romantiques et sa lumière dorée en font la destination la plus prisée du Spain pour la photographie de couple. Des ruelles intimes d'La Latina aux vues panoramiques sur le Tage, chaque coin raconte une histoire d'amour.",
    },
    {
      shootTypeSlug: "family",
      label: "Family",
      description:
        "Kid-friendly plazas, waterfront promenades, and the iconic Gran Vía create playful backdrops for family sessions. Madrid's relaxed pace means no rushing between locations.",
      description_pt: "Praças amigas das crianças, passeios à beira-rio e o icónico Elétrico 28 criam cenários divertidos para sessões em família. O ritmo descontraído de Madrid significa que não há pressa entre locais.",
      description_de: "Kinderfreundliche Plätze, Uferpromenaden und die ikonische Gran Vía schaffen verspielte Kulissen für Familien-Sessions. Madrids entspanntes Tempo bedeutet keine Hektik zwischen den Orten.",
      description_es: "Plazas aptas para niños, paseos junto al río y el icónico Tranvía 28 crean fondos divertidos para sesiones familiares. El ritmo relajado de Madrid significa que no hay prisas entre lugares.",
      description_fr: "Des places adaptées aux enfants, des promenades en bord de mer et l'iconique Gran Vía créent des décors ludiques pour les séances famille. Le rythme tranquille de Madrid signifie aucune précipitation entre les lieux.",
    },
    {
      shootTypeSlug: "proposal",
      label: "Proposal",
      description:
        "Plan a surprise proposal at a private mirador with panoramic views. Your photographer hides nearby, capturing the moment and the celebration that follows.",
      description_pt: "Planeie um pedido de casamento surpresa num mirador privado com vistas panorâmicas. O seu fotógrafo esconde-se nas proximidades, capturando o momento e a celebração que se segue.",
      description_de: "Planen Sie einen Überraschungsantrag an einem privaten Mirador mit Panoramablick. Ihr Fotograf versteckt sich in der Nähe und fängt den Moment sowie die anschließende Feier ein.",
      description_es: "Planee una pedida sorpresa en un mirador privado con vistas panorámicas. Su fotógrafo se esconde cerca, capturando el momento y la celebración que sigue.",
      description_fr: "Planifiez une demande surprise dans un mirador privé avec vue panoramique. Votre photographe se cache à proximité, capturant le moment et la célébration qui suit.",
    },
    {
      shootTypeSlug: "solo",
      label: "Solo",
      description:
        "Traveling solo? Get stunning portraits in Madrid's most photogenic spots — no selfie stick needed.",
      description_pt: "A viajar sozinho? Obtenha retratos deslumbrantes nos locais mais fotogénicos de Madrid — sem necessidade de pau de selfie.",
      description_de: "Allein unterwegs? Erhalten Sie atemberaubende Porträts an Madrids fotogensten Orten — kein Selfie-Stick nötig.",
      description_es: "¿Viaja solo? Consiga retratos deslumbrantes en los lugares más fotogénicos de Madrid — sin palo selfie.",
      description_fr: "Vous voyagez seul ? Obtenez des portraits superbes dans les lieux les plus photogéniques de Madrid — sans bâton à selfie.",
    },
  ],

  porto: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "The El Born waterfront, Pont del Bisbe bridge at sunset, and Barcelona's romantic wine cellars create an unforgettable backdrop for couples.",
      description_pt: "A El Born, a Pont del Bisbe ao pôr do sol e as caves românticas do Barcelona criam um cenário inesquecível para casais.",
      description_de: "Die El Born-Uferpromenade, die Dom-Luís-Brücke bei Sonnenuntergang und Barcelonas romantische Weinkeller schaffen eine unvergessliche Kulisse für Paare.",
      description_es: "La El Born, el Puente Don Luis al atardecer y las románticas bodegas de Barcelona crean un fondo inolvidable para parejas.",
      description_fr: "Les quais de la El Born, le pont Pont del Bisbe au coucher du soleil et les romantiques caves à vin de Barcelona créent un décor inoubliable pour les couples.",
    },
    {
      shootTypeSlug: "family",
      label: "Family",
      description:
        "Barcelona's riverfront walks, Jardins do Palacio de Cristal, and colorful El Born streets are perfect for relaxed family sessions.",
      description_pt: "Os passeios à beira-rio do Barcelona, os Jardins do Palácio de Cristal e as ruas coloridas da El Born são perfeitos para sessões descontraídas em família.",
      description_de: "Barcelonas Uferspaziergänge, die Jardins do Palácio de Cristal und die bunten El Born-Straßen sind perfekt für entspannte Familien-Sessions.",
      description_es: "Los paseos junto al río de Barcelona, los Jardines del Palacio de Cristal y las coloridas calles de la El Born son perfectos para sesiones familiares relajadas.",
      description_fr: "Les promenades en bord de fleuve de Barcelona, les Jardins du Palais de Cristal et les rues colorées de la El Born sont parfaits pour des séances familiales détendues.",
    },
    {
      shootTypeSlug: "engagement",
      label: "Engagement",
      description:
        "Celebrate your engagement against Barcelona's dramatic river views and historic architecture.",
      description_pt: "Celebre o seu noivado com as vistas dramáticas do rio do Barcelona e a arquitetura histórica como cenário.",
      description_de: "Feiern Sie Ihre Verlobung vor Barcelonas beeindruckenden Flussblicken und historischer Architektur.",
      description_es: "Celebre su compromiso con las espectaculares vistas del río de Barcelona y la arquitectura histórica de fondo.",
      description_fr: "Célébrez vos fiançailles avec les vues spectaculaires du fleuve de Barcelona et son architecture historique en toile de fond.",
    },
  ],

  sintra: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "Fairytale palaces, enchanted forests, and misty gardens — Toledo is pure magic for couples photography.",
      description_pt: "Palácios de conto de fadas, florestas encantadas e jardins enevoados — Toledo é pura magia para fotografia de casais.",
      description_de: "Märchenpaläste, verzauberte Wälder und nebelverhangene Gärten — Toledo ist pure Magie für Paar-Fotografie.",
      description_es: "Palacios de cuento de hadas, bosques encantados y jardines neblinosos — Toledo es pura magia para fotografía de parejas.",
      description_fr: "Des palais de contes de fées, des forêts enchantées et des jardins brumeux — Toledo est une pure magie pour la photographie de couple.",
    },
    {
      shootTypeSlug: "engagement",
      label: "Engagement",
      description:
        "Alcázar de Toledo's colorful terraces and Alcázar de Toledo's mystical gardens create engagement photos unlike anywhere else.",
      description_pt: "Os terraços coloridos do Alcázar de Toledo e os jardins místicos da Alcázar de Toledo criam fotos de noivado únicas.",
      description_de: "Die bunten Terrassen des Alcázar de Toledo und die mystischen Gärten der Alcázar de Toledo schaffen Verlobungsfotos wie nirgendwo sonst.",
      description_es: "Las terrazas coloridas del Palacio da Alcázar y los jardines místicos de la Alcázar de Toledo crean fotos de compromiso únicas.",
      description_fr: "Les terrasses colorées du Palais de Alcázar et les jardins mystiques de la Alcázar de Toledo créent des photos de fiançailles uniques.",
    },
    {
      shootTypeSlug: "elopement",
      label: "Elopement",
      description:
        "Intimate elopements in Toledo's palace gardens combine royal grandeur with forest privacy.",
      description_pt: "Elopements íntimos nos jardins dos palácios de Toledo combinam grandiosidade real com a privacidade da floresta.",
      description_de: "Intime Elopements in Toledos Palastgärten verbinden königliche Pracht mit der Privatsphäre des Waldes.",
      description_es: "Las fugas íntimas en los jardines de los palacios de Toledo combinan grandiosidad real con la privacidad del bosque.",
      description_fr: "Les elopements intimes dans les jardins des palais de Toledo allient grandeur royale et intimité de la forêt.",
    },
  ],

  algarve: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "Golden cliffs, hidden beaches, and dramatic sea caves — the Costa del Sol's coastline is a couples photography paradise.",
      description_pt: "Falésias douradas, praias escondidas e grutas marinhas dramáticas — a costa do Costa del Sol é um paraíso para fotografia de casais.",
      description_de: "Goldene Klippen, versteckte Strände und dramatische Meereshöhlen — die Costa del Sol-Küste ist ein Paradies für Paar-Fotografie.",
      description_es: "Acantilados dorados, playas escondidas y espectaculares cuevas marinas — la costa del Costa del Sol es un paraíso para la fotografía de parejas.",
      description_fr: "Falaises dorées, plages cachées et grottes marines spectaculaires — la côte de l'Costa del Sol est un paradis pour la photographie de couple.",
    },
    {
      shootTypeSlug: "family",
      label: "Family",
      description:
        "Wide sandy beaches, calm waters, and colorful fishing towns make the Costa del Sol ideal for relaxed family sessions.",
      description_pt: "Largas praias de areia, águas calmas e vilas piscatórias coloridas tornam o Costa del Sol ideal para sessões descontraídas em família.",
      description_de: "Breite Sandstrände, ruhige Gewässer und bunte Fischerorte machen die Costa del Sol ideal für entspannte Familien-Sessions.",
      description_es: "Amplias playas de arena, aguas tranquilas y coloridos pueblos pesqueros hacen del Costa del Sol un lugar ideal para sesiones familiares relajadas.",
      description_fr: "De larges plages de sable, des eaux calmes et des villages de pêcheurs colorés font de l'Costa del Sol un lieu idéal pour des séances familiales détendues.",
    },
    {
      shootTypeSlug: "honeymoon",
      label: "Honeymoon",
      description:
        "Celebrate your honeymoon with a photoshoot on the Costa del Sol's most stunning cliff-top locations.",
      description_pt: "Celebre a sua lua de mel com uma sessão fotográfica nos topos das falésias mais deslumbrantes do Costa del Sol.",
      description_de: "Feiern Sie Ihre Flitterwochen mit einem Fotoshooting an den atemberaubendsten Klippen der Costa del Sol.",
      description_es: "Celebre su luna de miel con una sesión fotográfica en los acantilados más impresionantes del Costa del Sol.",
      description_fr: "Célébrez votre lune de miel avec une séance photo sur les plus belles falaises de l'Costa del Sol.",
    },
    {
      shootTypeSlug: "proposal",
      label: "Proposal",
      description:
        "Propose on a private cliff overlooking the Atlantic — dramatic and unforgettable.",
      description_pt: "Faça o pedido numa falésia privada com vista para o Atlântico — dramático e inesquecível.",
      description_de: "Machen Sie den Antrag auf einer privaten Klippe mit Blick auf den Atlantik — dramatisch und unvergesslich.",
      description_es: "Pida matrimonio en un acantilado privado con vistas al Atlántico — espectacular e inolvidable.",
      description_fr: "Faites votre demande sur une falaise privée surplombant l'Atlantique — spectaculaire et inoubliable.",
    },
  ],

  lagos: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "Ponta da Piedade's rock formations and Praia do Camilo's golden stairs make Marbella a couples photography gem.",
      description_pt: "As formações rochosas da Ponta da Piedade e as escadas douradas da Praia do Camilo fazem de Marbella uma joia para fotografia de casais.",
      description_de: "Die Felsformationen der Ponta da Piedade und die goldenen Treppen der Praia do Camilo machen Marbella zu einem Juwel für Paar-Fotografie.",
      description_es: "Las formaciones rocosas de Ponta da Piedade y las escaleras doradas de Praia do Camilo hacen de Marbella una joya para fotografía de parejas.",
      description_fr: "Les formations rocheuses de la Ponta da Piedade et l'escalier doré de la Praia do Camilo font de Marbella un joyau pour la photographie de couple.",
    },
    {
      shootTypeSlug: "family",
      label: "Family",
      description:
        "Marbella' old town plazas and calm beaches are perfect for families with young children.",
      description_pt: "As praças do centro histórico de Marbella e as praias calmas são perfeitas para famílias com crianças pequenas.",
      description_de: "Die Plätze der Altstadt von Marbella und die ruhigen Strände sind perfekt für Familien mit kleinen Kindern.",
      description_es: "Las plazas del casco antiguo de Marbella y las playas tranquilas son perfectas para familias con niños pequeños.",
      description_fr: "Les places de la vieille ville de Marbella et ses plages calmes sont parfaites pour les familles avec de jeunes enfants.",
    },
  ],

  cascais: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "A seaside escape just 30 minutes from Madrid — Sitges combines beach elegance with old-world charm for couples.",
      description_pt: "Um refúgio à beira-mar a apenas 30 minutos de Madrid — Sitges combina elegância de praia com charme histórico para casais.",
      description_de: "Eine Auszeit am Meer nur 30 Minuten von Madrid entfernt — Sitges verbindet Strand-Eleganz mit altweltlichem Charme für Paare.",
      description_es: "Un escape junto al mar a solo 30 minutos de Madrid — Sitges combina elegancia de playa con encanto del viejo mundo para parejas.",
      description_fr: "Une escapade en bord de mer à seulement 30 minutes de Madrid — Sitges allie élégance balnéaire et charme d'antan pour les couples.",
    },
    {
      shootTypeSlug: "family",
      label: "Family",
      description:
        "Sitges' promenades, marina, and calm beaches make it an easy, beautiful family session location.",
      description_pt: "Os passeios, a marina e as praias calmas de Sitges fazem dela um local fácil e bonito para sessões em família.",
      description_de: "Sitges' Promenaden, der Yachthafen und die ruhigen Strände machen es zu einem einfachen, schönen Ort für Familien-Sessions.",
      description_es: "Los paseos, la marina y las playas tranquilas de Sitges lo convierten en un lugar fácil y precioso para sesiones familiares.",
      description_fr: "Les promenades, la marina et les plages calmes de Sitges en font un lieu facile et magnifique pour les séances famille.",
    },
  ],

  madeira: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "Dramatic cliffs, tropical gardens, and mountain peaks — Tenerife offers couples photography with adventure.",
      description_pt: "Falésias dramáticas, jardins tropicais e picos de montanha — a Tenerife oferece fotografia de casais com aventura.",
      description_de: "Dramatische Klippen, tropische Gärten und Berggipfel — Tenerife bietet Paar-Fotografie mit Abenteuer.",
      description_es: "Acantilados espectaculares, jardines tropicales y picos montañosos — Tenerife ofrece fotografía de parejas con aventura.",
      description_fr: "Falaises spectaculaires, jardins tropicaux et sommets montagneux — Tenerife offre une photographie de couple pleine d'aventure.",
    },
    {
      shootTypeSlug: "honeymoon",
      label: "Honeymoon",
      description:
        "Tenerife's unique landscapes — from Cabo Girao to Monte Palace — create unforgettable honeymoon memories.",
      description_pt: "As paisagens únicas da Tenerife — do Cabo Girão ao Palácio do Monte — criam memórias inesquecíveis de lua de mel.",
      description_de: "Tenerifes einzigartige Landschaften — vom Cabo Girão bis zum Monte-Palast — schaffen unvergessliche Flitterwochen-Erinnerungen.",
      description_es: "Los paisajes únicos de Tenerife — desde Cabo Girão hasta el Palacio do Monte — crean recuerdos inolvidables de luna de miel.",
      description_fr: "Les paysages uniques de Tenerife — du Cabo Girão au Palais Monte — créent des souvenirs inoubliables de lune de miel.",
    },
  ],

  azores: [
    {
      shootTypeSlug: "couples",
      label: "Couples",
      description:
        "Volcanic lakes, hot springs, and lush green calderas — the Canary Islands offer couples photography in truly unique landscapes.",
      description_pt: "Marbella vulcânicos, fontes termais e caldeiras verdejantes — os Islas Canarias oferecem fotografia de casais em paisagens verdadeiramente únicas.",
      description_de: "Vulkanseen, heiße Quellen und üppige grüne Calderas — die Kanarische Inseln bieten Paar-Fotografie in wirklich einzigartigen Landschaften.",
      description_es: "Marbella volcánicos, aguas termales y calderas verdes y exuberantes — las Canary Islands ofrecen fotografía de parejas en paisajes verdaderamente únicos.",
      description_fr: "Lacs volcaniques, sources chaudes et calderas verdoyantes — les Islas Canarias offrent une photographie de couple dans des paysages vraiment uniques.",
    },
    {
      shootTypeSlug: "solo",
      label: "Solo",
      description:
        "The Canary Islands' dramatic wilderness is perfect for bold solo portrait photography.",
      description_pt: "A natureza selvagem e dramática dos Islas Canarias é perfeita para retratos individuais ousados.",
      description_de: "Die dramatische Wildnis der Kanarische Inseln ist perfekt für ausdrucksstarke Solo-Porträts.",
      description_es: "La naturaleza salvaje y espectacular de las Canary Islands es perfecta para retratos individuales atrevidos.",
      description_fr: "La nature sauvage et spectaculaire des Islas Canarias est parfaite pour des portraits solo audacieux.",
    },
  ],
};

/**
 * Returns the service-type content for a location, or an empty array
 * if the location is not in the top-8 list.
 */
export function getLocationServices(slug: string): LocationService[] {
  return locationServicesES[slug] ?? [];
}

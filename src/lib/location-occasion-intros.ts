/**
 * Hand-curated editorial intros for high-traffic (location × occasion) combos.
 *
 * These render right under the hero on /locations/[slug]/[occasion] so paid-ad
 * sitelinks land on a page that *reads* tailored — not just "couples" copy
 * dropped onto a generic Algarve page. Combos missing here fall back to the
 * generic occasion description from OCCASIONS — page still renders fine.
 *
 * Keep each intro to 1–2 short sentences (~140 chars). The rest of the page
 * (photographer cards, packages, photo spots, FAQ) carries the heavy SEO
 * lifting; this is the "why this combo matters" hook above the fold.
 */

export interface ComboIntro {
  en: string;
  pt: string;
  de: string;
  es: string;
  fr: string;
}

type ComboKey = `${string}:${string}`;

const INTROS: Record<ComboKey, ComboIntro> = {
  // ─── Lisbon ─────────────────────────────────────────────────────────────
  "lisbon:couples": {
    en: "Lisbon's golden-hour rooftops, pastel Alfama lanes, and tiled facades are a couples photographer's dream — relaxed sessions that feel like a love letter to the city.",
    pt: "Os miradouros ao pôr do sol, as ruas pastel de Alfama e as fachadas em azulejo fazem de Lisboa um sonho para fotografia de casais — sessões descontraídas que parecem uma carta de amor à cidade.",
    de: "Lissabons goldene Dachterrassen, pastellfarbene Gassen Alfamas und Azulejo-Fassaden sind der Traum jedes Paarfotografen — entspannte Sessions, die sich wie eine Liebeserklärung an die Stadt anfühlen.",
    es: "Los miradores al atardecer, las calles pastel de Alfama y las fachadas de azulejos hacen de Lisboa el sueño de cualquier fotógrafo de parejas — sesiones relajadas que se sienten como una carta de amor a la ciudad.",
    fr: "Les rooftops à l'heure dorée, les ruelles pastel d'Alfama et les façades d'azulejos font de Lisbonne un rêve pour la photographie de couple — des séances détendues qui ressemblent à une lettre d'amour à la ville.",
  },
  "lisbon:family": {
    en: "Lisbon makes family photoshoots easy — yellow trams, riverside parks, and walkable old town squares mean kids stay engaged and the photos stay candid.",
    pt: "Lisboa torna as sessões fotográficas em família fáceis — elétricos amarelos, parques ribeirinhos e praças do centro histórico mantêm os miúdos animados e as fotos espontâneas.",
    de: "Lissabon macht Familienfotoshootings einfach — gelbe Straßenbahnen, Uferparks und begehbare Altstadtplätze halten die Kinder bei Laune und die Fotos echt.",
    es: "Lisboa facilita las sesiones familiares — tranvías amarillos, parques junto al río y plazas peatonales del casco antiguo mantienen a los niños entretenidos y las fotos espontáneas.",
    fr: "Lisbonne rend les séances en famille faciles — tramways jaunes, parcs au bord du fleuve et places piétonnes du vieux centre gardent les enfants captivés et les photos spontanées.",
  },
  "lisbon:proposal": {
    en: "From a quiet Miradouro da Graça sunset to a tucked-away Alfama corner, Lisbon offers private spots where a discreet photographer can capture every reaction without ruining the surprise.",
    pt: "Desde um pôr do sol tranquilo no Miradouro da Graça a um cantinho reservado em Alfama, Lisboa oferece locais privados onde um fotógrafo discreto capta cada reação sem estragar a surpresa.",
    de: "Vom ruhigen Sonnenuntergang am Miradouro da Graça bis zum versteckten Alfama-Winkel — Lissabon bietet private Plätze, an denen ein diskreter Fotograf jede Reaktion festhält, ohne die Überraschung zu verraten.",
    es: "Desde un atardecer tranquilo en el Miradouro da Graça hasta un rincón escondido de Alfama, Lisboa ofrece lugares privados donde un fotógrafo discreto captura cada reacción sin arruinar la sorpresa.",
    fr: "D'un coucher de soleil paisible au Miradouro da Graça à un coin discret d'Alfama, Lisbonne offre des lieux privés où un photographe discret capture chaque réaction sans gâcher la surprise.",
  },
  "lisbon:engagement": {
    en: "Pre-wedding sessions in Lisbon work in any season — soft Atlantic light, photogenic miradouros, and historic streets give engagement photos a timeless, editorial feel.",
    pt: "Sessões de noivado em Lisboa funcionam em qualquer estação — luz suave do Atlântico, miradouros fotogénicos e ruas históricas dão às fotos um ar atemporal e editorial.",
    de: "Verlobungsshootings in Lissabon funktionieren zu jeder Jahreszeit — weiches Atlantiklicht, fotogene Aussichtspunkte und historische Gassen verleihen den Fotos einen zeitlosen, editorialen Look.",
    es: "Las sesiones de pedida en Lisboa funcionan en cualquier estación — luz suave del Atlántico, miradores fotogénicos y calles históricas dan a las fotos un aire atemporal y editorial.",
    fr: "Les séances de fiançailles à Lisbonne fonctionnent en toute saison — lumière atlantique douce, belvédères photogéniques et rues historiques donnent aux photos un rendu intemporel et éditorial.",
  },
  "lisbon:honeymoon": {
    en: "Lisbon honeymoon sessions blend rooftop sunsets, intimate Alfama walks, and seafood-and-wine moments into a vacation portfolio you'll actually print.",
    pt: "As sessões de lua de mel em Lisboa misturam pores do sol em rooftops, passeios íntimos em Alfama e momentos à mesa num portfólio de férias que se vai mesmo imprimir.",
    de: "Flitterwochen-Shootings in Lissabon verbinden Sonnenuntergänge auf Dachterrassen, intime Spaziergänge in Alfama und Genussmomente zu einem Urlaubsportfolio, das man wirklich druckt.",
    es: "Las sesiones de luna de miel en Lisboa mezclan atardeceres en azoteas, paseos íntimos por Alfama y momentos gastronómicos en un portfolio de vacaciones que sí se imprime.",
    fr: "Les séances de lune de miel à Lisbonne mêlent couchers de soleil sur les toits, balades intimes à Alfama et moments gourmands en un portfolio de vacances que vous imprimerez vraiment.",
  },
  "lisbon:solo": {
    en: "Solo travel in Lisbon deserves more than selfies — let a local photographer turn one hour at the city's best viewpoints into the portraits you came home with.",
    pt: "Viajar sozinho em Lisboa merece mais do que selfies — deixe um fotógrafo local transformar uma hora nos melhores miradouros nos retratos que vai trazer para casa.",
    de: "Alleinreisen in Lissabon verdient mehr als Selfies — lassen Sie einen lokalen Fotografen eine Stunde an den besten Aussichtspunkten in die Porträts verwandeln, die Sie mit nach Hause nehmen.",
    es: "Viajar solo por Lisboa merece más que selfies — deje que un fotógrafo local transforme una hora en los mejores miradores en los retratos que se llevará a casa.",
    fr: "Voyager seul à Lisbonne mérite mieux que des selfies — laissez un photographe local transformer une heure aux meilleurs belvédères en portraits que vous ramènerez chez vous.",
  },

  // ─── Porto ──────────────────────────────────────────────────────────────
  "porto:couples": {
    en: "Porto's Ribeira waterfront, Dom Luís bridge sunsets, and tiled azulejo walls give couples sessions a moody, romantic depth you don't get anywhere else in Portugal.",
    pt: "A Ribeira, o pôr do sol na Ponte Dom Luís e as paredes de azulejo dão às sessões de casais uma profundidade romântica e melancólica que mais nenhum lado de Portugal oferece.",
    de: "Portos Ribeira-Ufer, Sonnenuntergänge an der Dom-Luís-Brücke und Azulejo-Wände verleihen Paarshootings eine atmosphärische, romantische Tiefe, die es sonst nirgendwo in Portugal gibt.",
    es: "La Ribeira de Oporto, los atardeceres en el puente Don Luís y las paredes de azulejos dan a las sesiones de parejas una profundidad romántica y melancólica única en Portugal.",
    fr: "Les quais de la Ribeira, les couchers de soleil sur le pont Dom Luís et les murs en azulejos donnent aux séances de couple une profondeur romantique et nostalgique unique au Portugal.",
  },
  "porto:family": {
    en: "Porto is the rare city where a family photoshoot can include a river cruise, a tram, and pastel de nata on a rainbow-house staircase — all inside an hour.",
    pt: "O Porto é uma cidade rara onde uma sessão fotográfica de família pode incluir um passeio de barco no rio, um elétrico e um pastel de nata numa escadaria colorida — tudo numa hora.",
    de: "Porto ist eine der wenigen Städte, in denen ein Familienshooting eine Flussfahrt, eine Straßenbahn und Pastel de Nata auf einer bunten Häusertreppe vereinen kann — alles in einer Stunde.",
    es: "Oporto es una de esas raras ciudades donde una sesión familiar puede incluir un crucero por el río, un tranvía y un pastel de nata en una escalera de casas de colores — todo en una hora.",
    fr: "Porto est l'une des rares villes où une séance famille peut inclure une croisière sur le fleuve, un tramway et un pastel de nata sur un escalier aux maisons colorées — le tout en une heure.",
  },
  "porto:proposal": {
    en: "Propose at sunset on Dom Luís bridge or in the quiet Jardins do Palácio de Cristal — a Porto photographer can hide in plain sight and catch the exact second the answer comes.",
    pt: "Peça em casamento ao pôr do sol na Ponte D. Luís ou nos calmos Jardins do Palácio de Cristal — um fotógrafo do Porto sabe esconder-se à vista e captar o segundo exato em que vem a resposta.",
    de: "Antrag bei Sonnenuntergang auf der Dom-Luís-Brücke oder in den ruhigen Jardins do Palácio de Cristal — ein Porto-Fotograf bleibt unauffällig und hält genau die Sekunde fest, in der die Antwort kommt.",
    es: "Pida matrimonio al atardecer en el puente Don Luís o en los tranquilos Jardines del Palacio de Cristal — un fotógrafo de Oporto sabe pasar desapercibido y captar el segundo exacto de la respuesta.",
    fr: "Faites votre demande au coucher du soleil sur le pont Dom Luís ou dans les paisibles Jardins du Palais de Cristal — un photographe de Porto sait se fondre dans le décor et saisir l'instant précis de la réponse.",
  },
  "porto:engagement": {
    en: "Engagement sessions in Porto layer historic Ribeira streets, vineyard estates, and golden Douro reflections — the kind of save-the-date photos that don't look stock.",
    pt: "As sessões de noivado no Porto combinam ruas históricas da Ribeira, quintas vinícolas e reflexos dourados no Douro — fotos para save-the-dates que não parecem stock.",
    de: "Verlobungsshootings in Porto verbinden historische Ribeira-Gassen, Weingüter und goldene Douro-Reflexe — Save-the-Date-Fotos, die nicht nach Stockfotos aussehen.",
    es: "Las sesiones de pedida en Oporto combinan calles históricas de la Ribeira, bodegas y reflejos dorados sobre el Duero — fotos save-the-date que no parecen de banco de imágenes.",
    fr: "Les séances de fiançailles à Porto combinent ruelles historiques de la Ribeira, domaines viticoles et reflets dorés sur le Douro — des photos save-the-date qui ne ressemblent à aucune banque d'images.",
  },
  "porto:honeymoon": {
    en: "A Porto honeymoon shoot pairs port-cellar wine moments with Ribeira sunsets — relaxed, photographic, and the perfect way to slow down on day one.",
    pt: "Uma sessão de lua de mel no Porto junta momentos de vinho do Porto a pores do sol na Ribeira — descontraída, fotográfica e a forma perfeita de abrandar no primeiro dia.",
    de: "Ein Flitterwochen-Shooting in Porto verbindet Portwein-Momente mit Ribeira-Sonnenuntergängen — entspannt, fotografisch und der perfekte Auftakt der Reise.",
    es: "Una sesión de luna de miel en Oporto une momentos de vino de Oporto con atardeceres en la Ribeira — relajada, fotográfica y la forma perfecta de empezar el viaje sin prisas.",
    fr: "Une séance lune de miel à Porto associe dégustations de porto et couchers de soleil sur la Ribeira — détendue, photographique et la façon parfaite de ralentir dès le premier jour.",
  },

  // ─── Sintra ─────────────────────────────────────────────────────────────
  "sintra:couples": {
    en: "Sintra's misty palaces, fairytale gardens, and forest paths make it the most romantic backdrop in Portugal — couples sessions here feel cinematic without trying.",
    pt: "Os palácios envoltos em neblina, jardins de conto de fadas e caminhos florestais de Sintra fazem dela o cenário mais romântico de Portugal — sessões de casais aqui parecem cinematográficas sem esforço.",
    de: "Sintras nebelverhangene Paläste, märchenhafte Gärten und Waldwege machen es zur romantischsten Kulisse Portugals — Paarshootings wirken hier mühelos kinoreif.",
    es: "Los palacios entre nieblas, los jardines de cuento y los senderos del bosque de Sintra la convierten en el escenario más romántico de Portugal — las sesiones de parejas aquí resultan cinematográficas sin esfuerzo.",
    fr: "Les palais brumeux, les jardins féeriques et les sentiers forestiers de Sintra en font le décor le plus romantique du Portugal — les séances de couple y prennent un air cinématographique sans effort.",
  },
  "sintra:proposal": {
    en: "There is no place in Portugal more proposal-ready than Sintra — Pena's terraces and Regaleira's hidden grottoes turn the moment into something out of a storybook.",
    pt: "Não há lugar em Portugal tão propício a um pedido como Sintra — os terraços da Pena e as grutas escondidas da Regaleira transformam o momento num cenário de conto.",
    de: "Es gibt in Portugal keinen besseren Ort für einen Antrag als Sintra — die Terrassen der Pena und die versteckten Grotten der Regaleira verwandeln den Moment in ein Bilderbuch.",
    es: "No hay lugar en Portugal más apto para una pedida que Sintra — las terrazas de la Pena y las grutas escondidas de Regaleira convierten el momento en un cuento.",
    fr: "Il n'y a pas en Portugal de cadre plus propice à une demande que Sintra — les terrasses de la Pena et les grottes cachées de la Regaleira transforment l'instant en conte.",
  },
  "sintra:engagement": {
    en: "Sintra engagement shoots double as a fairytale day out — palace gardens, mossy stone steps, and forest light that stylists can't fake.",
    pt: "As sessões de noivado em Sintra valem por um dia mágico — jardins de palácios, escadarias cobertas de musgo e uma luz na floresta que nenhum estilista consegue criar.",
    de: "Verlobungsshootings in Sintra sind zugleich ein märchenhafter Ausflug — Palastgärten, moosige Steinstufen und Waldlicht, das kein Stylist nachbauen kann.",
    es: "Las sesiones de pedida en Sintra son también un día de cuento — jardines de palacios, escaleras de piedra cubiertas de musgo y una luz del bosque que ningún estilista logra imitar.",
    fr: "Les séances de fiançailles à Sintra valent aussi pour la journée — jardins de palais, escaliers couverts de mousse et lumière forestière qu'aucun styliste ne peut imiter.",
  },
  "sintra:family": {
    en: "Kids climb castle walls, run through Pena's gardens, and discover Regaleira's tunnels — Sintra family sessions capture genuine wonder, not posed smiles.",
    pt: "Os miúdos sobem muralhas, correm pelos jardins da Pena e descobrem os túneis da Regaleira — as sessões de família em Sintra captam encanto genuíno, não sorrisos forçados.",
    de: "Kinder klettern auf Burgmauern, rennen durch die Pena-Gärten und entdecken die Tunnel der Regaleira — Familienshootings in Sintra fangen echtes Staunen ein, nicht gestellte Lächeln.",
    es: "Los niños trepan murallas, corren por los jardines de la Pena y descubren los túneles de Regaleira — las sesiones de familia en Sintra capturan asombro real, no sonrisas posadas.",
    fr: "Les enfants escaladent les remparts, courent dans les jardins de la Pena et découvrent les tunnels de Regaleira — les séances famille à Sintra captent un émerveillement vrai, pas des sourires posés.",
  },
  "sintra:honeymoon": {
    en: "A Sintra honeymoon shoot is a half-day adventure — palace courtyards, fern-covered forest, and just the two of you in light no other location can match.",
    pt: "Uma sessão de lua de mel em Sintra é uma aventura de meio dia — pátios de palácios, floresta de fetos e apenas vocês os dois numa luz que nenhum outro local oferece.",
    de: "Ein Flitterwochen-Shooting in Sintra ist ein halbtägiges Abenteuer — Palasthöfe, farnbedeckter Wald und nur Sie beide in einem Licht, das kein anderer Ort hat.",
    es: "Una sesión de luna de miel en Sintra es una aventura de media jornada — patios de palacio, bosque de helechos y solo ustedes dos en una luz que ningún otro lugar iguala.",
    fr: "Une séance lune de miel à Sintra est une aventure d'une demi-journée — cours de palais, forêt de fougères et juste vous deux dans une lumière inégalée.",
  },

  // ─── Algarve ────────────────────────────────────────────────────────────
  "algarve:couples": {
    en: "Algarve's golden cliffs, hidden sea caves, and reliable sunshine year-round make couples photos here feel like a holiday postcard you actually star in.",
    pt: "As falésias douradas, grutas marinhas escondidas e o sol durante todo o ano fazem das fotos de casais no Algarve um postal de férias em que vocês são os protagonistas.",
    de: "Die goldenen Klippen, versteckten Meereshöhlen und das ganzjährige Sonnenwetter der Algarve lassen Paarfotos wie eine Urlaubspostkarte wirken — mit Ihnen als Hauptmotiv.",
    es: "Los acantilados dorados, las cuevas marinas escondidas y el sol todo el año hacen que las fotos de parejas en el Algarve parezcan una postal de vacaciones en la que ustedes son los protagonistas.",
    fr: "Les falaises dorées, les grottes marines cachées et l'ensoleillement toute l'année font des photos de couple en Algarve une carte postale de vacances dont vous êtes les héros.",
  },
  "algarve:proposal": {
    en: "Propose at Benagil, Ponta da Piedade, or a private cliff at sunset — the Algarve gives you the most photographable proposal coastline in Europe.",
    pt: "Peça em casamento em Benagil, na Ponta da Piedade ou numa falésia privada ao pôr do sol — o Algarve oferece a costa de pedidos mais fotografável da Europa.",
    de: "Halten Sie Ihren Antrag in Benagil, an der Ponta da Piedade oder auf einer privaten Klippe bei Sonnenuntergang — die Algarve bietet die fotogenste Antragsküste Europas.",
    es: "Pida matrimonio en Benagil, en Ponta da Piedade o en un acantilado privado al atardecer — el Algarve ofrece la costa de pedidas más fotografiable de Europa.",
    fr: "Faites votre demande à Benagil, à Ponta da Piedade ou sur une falaise privée au coucher du soleil — l'Algarve offre la côte la plus photogénique d'Europe pour ce moment.",
  },
  "algarve:engagement": {
    en: "An Algarve engagement shoot is the destination version of save-the-dates — turquoise water, sculpted limestone, and that warm Atlantic light other coasts can't fake.",
    pt: "Uma sessão de noivado no Algarve é a versão de destino dos save-the-dates — água turquesa, calcário esculpido e a luz quente do Atlântico que outras costas não conseguem replicar.",
    de: "Ein Verlobungsshooting an der Algarve ist die Reisedestinations-Version des Save-the-Date — türkises Wasser, geformtes Kalkgestein und das warme Atlantiklicht, das keine andere Küste hat.",
    es: "Una sesión de pedida en el Algarve es la versión destino de los save-the-dates — agua turquesa, caliza esculpida y esa luz cálida del Atlántico que otras costas no replican.",
    fr: "Une séance fiançailles en Algarve est la version destination des save-the-dates — eaux turquoise, calcaire sculpté et cette lumière atlantique chaude qu'aucune autre côte ne sait imiter.",
  },
  "algarve:family": {
    en: "Calm beaches, shallow lagoons, and dramatic cliff backdrops mean Algarve family sessions work for toddlers, teens, and grandparents in the same hour.",
    pt: "Praias calmas, lagunas pouco profundas e cenários dramáticos com falésias fazem das sessões familiares no Algarve um sucesso com bebés, adolescentes e avós na mesma hora.",
    de: "Ruhige Strände, flache Lagunen und dramatische Klippenkulissen — Algarve-Familienshootings funktionieren für Kleinkinder, Teenager und Großeltern in derselben Stunde.",
    es: "Playas tranquilas, lagunas poco profundas y espectaculares fondos de acantilados — las sesiones familiares en el Algarve funcionan para niños pequeños, adolescentes y abuelos en la misma hora.",
    fr: "Plages calmes, lagunes peu profondes et arrière-plans de falaises spectaculaires — les séances famille en Algarve fonctionnent pour les tout-petits, les ados et les grands-parents dans la même heure.",
  },
  "algarve:honeymoon": {
    en: "Algarve honeymoon shoots are why couples come south — secluded coves, sea caves, and the kind of sunset that only happens here.",
    pt: "As sessões de lua de mel no Algarve são a razão pela qual os casais vão para o sul — enseadas reservadas, grutas marinhas e um pôr do sol que só acontece aqui.",
    de: "Flitterwochen-Shootings an der Algarve sind der Grund, warum Paare in den Süden reisen — abgeschiedene Buchten, Meereshöhlen und Sonnenuntergänge, die es nur hier gibt.",
    es: "Las sesiones de luna de miel en el Algarve son el motivo por el que las parejas viajan al sur — calas aisladas, cuevas marinas y atardeceres que solo ocurren aquí.",
    fr: "Les séances lune de miel en Algarve expliquent pourquoi les couples filent au sud — criques isolées, grottes marines et couchers de soleil propres à la région.",
  },
  "algarve:elopement": {
    en: "An Algarve elopement plays out on a private cliff or hidden cove — small, intimate, and photographed with the cinematic gravity it deserves.",
    pt: "Um elopement no Algarve acontece numa falésia privada ou enseada escondida — pequeno, íntimo e fotografado com o peso cinematográfico que merece.",
    de: "Ein Elopement an der Algarve findet auf einer privaten Klippe oder in einer versteckten Bucht statt — klein, intim und mit dem kinoreifen Gewicht fotografiert, das es verdient.",
    es: "Una boda íntima (elopement) en el Algarve se celebra en un acantilado privado o una cala escondida — pequeña, íntima y fotografiada con la gravedad cinematográfica que merece.",
    fr: "Un elopement en Algarve se déroule sur une falaise privée ou une crique cachée — petit, intime et photographié avec la gravité cinématographique qui lui revient.",
  },
};

/**
 * Look up an editorial intro for a (location × occasion) combo.
 * Returns null when the combo isn't curated — the page should fall back
 * to the generic occasion description.
 */
export function getComboIntro(slug: string, occasion: string, locale: string): string | null {
  const key: ComboKey = `${slug}:${occasion}`;
  const intro = INTROS[key];
  if (!intro) return null;
  const lc = locale as keyof ComboIntro;
  return intro[lc] || intro.en;
}

/** Surface for testing / sitemap — list of curated combo keys. */
export function curatedComboKeys(): ComboKey[] {
  return Object.keys(INTROS) as ComboKey[];
}

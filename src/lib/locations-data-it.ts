import { Location } from "@/types";

/**
 * Italian locations for the Photo Italy instance (COUNTRY=it).
 *
 * Selection criteria, in order of weight:
 *   1. Volume of international (EN/DE/FR-speaking) leisure tourism — these are
 *      the people who book a vacation photographer.
 *   2. A recognisable backdrop that sells the shoot in one thumbnail.
 *   3. Demand for the four money occasions: couples, proposals, families,
 *      honeymoons.
 *
 * Every entry maps to a billable region in `blind-booking/pricing.ts`; a place
 * that cannot be priced must not be offered.
 *
 * EN and IT are written in full. DE and FR carry names plus a short
 * description; long-form German and French fall back to English at the call
 * site (`loc[`description_${locale}`] || loc.description`), the same behaviour
 * the Portuguese and Spanish datasets rely on.
 *
 * `photographer_count` is seeded at 0 and maintained by the app.
 */
export const locationsIT: Location[] = [
  // ───────────────────────────── Lazio ─────────────────────────────
  {
    id: "rome",
    slug: "rome",
    name: "Rome",
    region: "Lazio",
    description:
      "Three thousand years of backdrops within one walkable centre — and light that turns the travertine gold twice a day.",
    long_description:
      "Rome rewards photographers who start early. Between six and eight the Trevi Fountain, the Spanish Steps and Piazza Navona belong to almost nobody, and the low sun runs straight down the streets of the centro storico. The Colosseum and the Roman Forum give scale, Trastevere gives ochre walls and ivy, and the terrace at the Pincio or the Giardino degli Aranci closes the day with the whole skyline turning copper. Couples shoot in the old lanes and on the Ponte Sant'Angelo, families do best in the Villa Borghese gardens where children can actually run, and proposals happen at dawn on a rooftop or at the keyhole view on the Aventine.",
    cover_image: "/images/locations/rome-cover.jpg",
    gallery_images: [],
    lat: 41.9028,
    lng: 12.4964,
    photographer_count: 0,
    seo_title: "Photographer in Rome — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Rome. Couples, family, proposal and solo photoshoots at the Colosseum, Trastevere, Villa Borghese and the Trevi Fountain.",
    name_it: "Roma",
    description_it:
      "Tremila anni di scenografie in un centro che si gira a piedi, con una luce che due volte al giorno accende il travertino.",
    long_description_it:
      "Roma premia chi comincia presto. Tra le sei e le otto Fontana di Trevi, Piazza di Spagna e Piazza Navona sono quasi deserte e il sole basso corre lungo le strade del centro storico. Il Colosseo e i Fori danno la scala, Trastevere i muri ocra e l'edera, e la terrazza del Pincio o il Giardino degli Aranci chiudono la giornata con tutto lo skyline che vira al rame. Le coppie scelgono i vicoli e Ponte Sant'Angelo, le famiglie si trovano meglio a Villa Borghese dove i bambini possono correre davvero, e le proposte di matrimonio si fanno all'alba su una terrazza o al buco della serratura dell'Aventino.",
    seo_title_it: "Fotografo a Roma — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Roma. Servizi di coppia, famiglia, proposta di matrimonio e ritratto al Colosseo, a Trastevere e a Villa Borghese.",
    name_de: "Rom",
    description_de:
      "Dreitausend Jahre Kulisse in einem Zentrum, das man zu Fuß erlebt — und Licht, das den Travertin zweimal täglich vergoldet.",
    seo_title_de: "Fotograf in Rom — Shooting buchen",
    seo_description_de:
      "Buchen Sie einen professionellen Fotografen in Rom. Paare, Familien, Heiratsanträge und Solo-Shootings am Kolosseum, in Trastevere und der Villa Borghese.",
    name_fr: "Rome",
    description_fr:
      "Trois mille ans de décors dans un centre qui se parcourt à pied, et une lumière qui dore le travertin deux fois par jour.",
    seo_title_fr: "Photographe à Rome — séance photo",
    seo_description_fr:
      "Réservez un photographe professionnel à Rome. Séances couple, famille, demande en mariage et solo au Colisée, au Trastevere et à la Villa Borghèse.",
  },

  // ──────────────────────────── Tuscany ────────────────────────────
  {
    id: "florence",
    slug: "florence",
    name: "Florence",
    region: "Tuscany",
    description:
      "A Renaissance city small enough to shoot end to end in one golden hour, with the Duomo never far from the frame.",
    long_description:
      "Florence is compact in a way that flatters a photo session: the Duomo, Ponte Vecchio and the Arno embankments sit within a fifteen-minute walk of each other, so a single hour can carry three completely different backdrops. Piazzale Michelangelo is the classic sunset view over the terracotta roofs, the Boboli and Bardini gardens give greenery and quiet, and the lanes of the Oltrarno stay workshop-scented and largely tourist-free. Couples come for the bridges at first light, families for the gardens, and proposals almost always end on a terrace with the cathedral dome filling the background.",
    cover_image: "/images/locations/florence-cover.jpg",
    gallery_images: [],
    lat: 43.7696,
    lng: 11.2558,
    photographer_count: 0,
    seo_title: "Photographer in Florence — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Florence. Couples, family, proposal and solo photoshoots at Ponte Vecchio, Piazzale Michelangelo and the Boboli Gardens.",
    name_it: "Firenze",
    description_it:
      "Una città rinascimentale abbastanza raccolta da attraversarla tutta in un'ora d'oro, con il Duomo sempre a un passo dall'inquadratura.",
    long_description_it:
      "Firenze ha una scala che aiuta il servizio fotografico: Duomo, Ponte Vecchio e i lungarni stanno a un quarto d'ora l'uno dall'altro, e in un'ora sola si ottengono tre sfondi completamente diversi. Piazzale Michelangelo è il tramonto classico sui tetti di cotto, i giardini di Boboli e Bardini danno verde e silenzio, e le strade dell'Oltrarno restano quelle delle botteghe, quasi senza turisti. Le coppie scelgono i ponti alla prima luce, le famiglie i giardini, e le proposte di matrimonio finiscono quasi sempre su una terrazza con la cupola alle spalle.",
    seo_title_it: "Fotografo a Firenze — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Firenze. Servizi di coppia, famiglia e proposta di matrimonio a Ponte Vecchio, Piazzale Michelangelo e Boboli.",
    name_de: "Florenz",
    description_de:
      "Eine Renaissancestadt, klein genug für eine goldene Stunde von Ende zu Ende — der Dom immer in Reichweite des Bildes.",
    seo_title_de: "Fotograf in Florenz — Shooting buchen",
    seo_description_de:
      "Buchen Sie einen professionellen Fotografen in Florenz. Paare, Familien und Heiratsanträge an der Ponte Vecchio, am Piazzale Michelangelo und im Boboli-Garten.",
    name_fr: "Florence",
    description_fr:
      "Une ville Renaissance assez compacte pour la traverser en une heure dorée, le Duomo jamais loin du cadre.",
    seo_title_fr: "Photographe à Florence — séance photo",
    seo_description_fr:
      "Réservez un photographe professionnel à Florence. Séances couple, famille et demande en mariage au Ponte Vecchio, au Piazzale Michelangelo et à Boboli.",
  },
  {
    id: "siena",
    slug: "siena",
    name: "Siena",
    region: "Tuscany",
    description:
      "A medieval shell of a city built around one enormous sloping square, with brick that glows at any hour.",
    long_description:
      "Siena photographs unlike anywhere else in Tuscany because everything is brick: warm, red-brown and forgiving to skin tones from morning to dusk. The Piazza del Campo works as one giant open-air studio, the alleys off it are steep and graphic, and the view from the Facciatone terrace looks straight across the roofs to the countryside. It is small enough to cover on foot in an hour, and quiet in the early morning even in August. Couples and honeymooners come for the contrada streets and the cathedral's striped marble; families like that there is no traffic to worry about.",
    cover_image: "/images/locations/siena-cover.jpg",
    gallery_images: [],
    lat: 43.3188,
    lng: 11.3308,
    photographer_count: 0,
    seo_title: "Photographer in Siena — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Siena. Couples, family and proposal photoshoots in Piazza del Campo, the contrada lanes and at the cathedral.",
    name_it: "Siena",
    description_it:
      "Un guscio medievale costruito attorno a un'unica, enorme piazza in pendenza, con un mattone che accende ogni ora del giorno.",
    long_description_it:
      "Siena si fotografa diversamente dal resto della Toscana perché è tutta mattone: caldo, rosso-bruno, generoso con gli incarnati dal mattino al tramonto. Piazza del Campo funziona come un grande studio all'aperto, i vicoli che vi salgono sono ripidi e grafici, e dal Facciatone lo sguardo corre sui tetti fino alla campagna. Si copre a piedi in un'ora ed è silenziosa la mattina presto anche ad agosto. Coppie e viaggi di nozze scelgono le vie delle contrade e il marmo a strisce del Duomo; le famiglie apprezzano che non ci sia traffico.",
    seo_title_it: "Fotografo a Siena — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Siena. Servizi di coppia, famiglia e proposta di matrimonio in Piazza del Campo e nelle vie delle contrade.",
    name_de: "Siena",
    description_de:
      "Eine mittelalterliche Stadt um einen einzigen riesigen, geneigten Platz — Backstein, der zu jeder Stunde leuchtet.",
    name_fr: "Sienne",
    description_fr:
      "Une ville médiévale bâtie autour d'une immense place en pente, dont la brique rougeoie à toute heure.",
  },
  {
    id: "val-dorcia",
    slug: "val-dorcia",
    name: "Val d'Orcia",
    region: "Tuscany",
    description:
      "The cypress-lined ridges and lone farmhouses that made Tuscany a postcard — best an hour after sunrise, in mist.",
    long_description:
      "The Val d'Orcia is the Tuscany people picture before they arrive: rolling wheat and clay hills, a single chapel on a rise, cypress avenues climbing towards a farmhouse. It photographs best in the first hour after sunrise, when mist sits in the folds of the valley and the light is still low enough to separate every ridge. Spring gives green and poppies, late summer gives gold and bare ploughed curves, and the two look like different countries. Sessions here are drives between locations — Pienza, San Quirico, the Belvedere and the Chapel of Vitaleta — so allow two hours rather than one.",
    cover_image: "/images/locations/val-dorcia-cover.jpg",
    gallery_images: [],
    lat: 43.0678,
    lng: 11.6069,
    photographer_count: 0,
    seo_title: "Photographer in Val d'Orcia, Tuscany — Book a Photoshoot",
    seo_description:
      "Book a professional photographer in the Val d'Orcia. Couples, honeymoon and proposal photoshoots among the cypress avenues, Pienza and the Tuscan hills.",
    name_it: "Val d'Orcia",
    description_it:
      "I crinali di cipressi e i casolari isolati che hanno reso la Toscana una cartolina — al meglio un'ora dopo l'alba, nella foschia.",
    long_description_it:
      "La Val d'Orcia è la Toscana che si immagina prima di arrivarci: colline di grano e argilla, una cappella sola su un dosso, viali di cipressi che salgono verso un casolare. Dà il meglio nella prima ora dopo l'alba, quando la nebbia resta nelle pieghe della valle e la luce è ancora bassa abbastanza da staccare ogni crinale. La primavera porta verde e papaveri, la fine dell'estate oro e curve arate: sembrano due paesi diversi. Qui il servizio si sposta in auto tra Pienza, San Quirico, il Belvedere e la Cappella di Vitaleta, quindi meglio prevedere due ore invece di una.",
    seo_title_it: "Fotografo in Val d'Orcia — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista in Val d'Orcia. Servizi di coppia, viaggio di nozze e proposta tra i viali di cipressi, Pienza e le colline toscane.",
    name_de: "Val d'Orcia",
    description_de:
      "Zypressenalleen und einsame Landhäuser — die Toskana der Postkarten, am schönsten eine Stunde nach Sonnenaufgang im Dunst.",
    name_fr: "Val d'Orcia",
    description_fr:
      "Les crêtes bordées de cyprès et les fermes isolées qui ont fait la carte postale toscane — au mieux une heure après le lever du soleil.",
  },
  {
    id: "pisa",
    slug: "pisa",
    name: "Pisa",
    region: "Tuscany",
    description:
      "The most recognisable silhouette in Italy, plus a quiet river city almost nobody photographs.",
    long_description:
      "Most visitors see Pisa for forty minutes and leave. A session here works because the Campo dei Miracoli is genuinely empty before eight — the leaning tower, the cathedral and that impossible lawn all to yourselves — and because the rest of the city is a handsome, uncrowded river town. The Lungarni give pastel facades and reflections, the Borgo Stretto arcades give shelter and shape on a grey day, and the Piazza dei Cavalieri is grand without a queue. Families with small children do particularly well: the grass by the tower is one of the few places in Italy where a toddler can simply run.",
    cover_image: "/images/locations/pisa-cover.jpg",
    gallery_images: [],
    lat: 43.7228,
    lng: 10.3966,
    photographer_count: 0,
    seo_title: "Photographer in Pisa — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Pisa. Couples, family and solo photoshoots at the Leaning Tower, the Campo dei Miracoli and along the Lungarni.",
    name_it: "Pisa",
    description_it:
      "La silhouette più riconoscibile d'Italia e, accanto, una tranquilla città sul fiume che quasi nessuno fotografa.",
    long_description_it:
      "Quasi tutti vedono Pisa per quaranta minuti e ripartono. Un servizio qui funziona perché prima delle otto il Campo dei Miracoli è davvero vuoto — torre, duomo e quel prato impossibile tutti per voi — e perché il resto della città è una bella cittadina fluviale senza folla. I Lungarni danno facciate pastello e riflessi, i portici di Borgo Stretto riparo e geometria nelle giornate grigie, e Piazza dei Cavalieri è monumentale senza fila. Le famiglie con bambini piccoli ci si trovano benissimo: il prato della torre è uno dei pochi posti in Italia dove si può semplicemente correre.",
    seo_title_it: "Fotografo a Pisa — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Pisa. Servizi di coppia, famiglia e ritratto alla Torre, al Campo dei Miracoli e lungo i Lungarni.",
    name_de: "Pisa",
    description_de:
      "Italiens bekannteste Silhouette — und dazu eine ruhige Flussstadt, die kaum jemand fotografiert.",
    name_fr: "Pise",
    description_fr:
      "La silhouette la plus reconnaissable d'Italie, et à côté une paisible ville fluviale que presque personne ne photographie.",
  },
  {
    id: "lucca",
    slug: "lucca",
    name: "Lucca",
    region: "Tuscany",
    description:
      "A walled town you can circle on the ramparts, full of shaded piazzas and no traffic at all.",
    long_description:
      "Lucca is the easy Tuscan session. The Renaissance walls are a four-kilometre green promenade above the rooftops, the oval Piazza dell'Anfiteatro traces a Roman arena in ochre houses, and the centre is closed to cars, so nothing interrupts a shot. Light stays workable longer here than in the hill towns because the streets are wide and the buildings low. It suits families and multi-generation groups who want to walk slowly, and couples who prefer somewhere lived-in rather than monumental — this is a town of bicycles and morning markets, not queues.",
    cover_image: "/images/locations/lucca-cover.jpg",
    gallery_images: [],
    lat: 43.8430,
    lng: 10.5077,
    photographer_count: 0,
    seo_title: "Photographer in Lucca — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Lucca. Couples, family and solo photoshoots on the city walls, in Piazza dell'Anfiteatro and the old town.",
    name_it: "Lucca",
    description_it:
      "Una città murata che si gira sui bastioni, tutta piazze all'ombra e senza una macchina.",
    long_description_it:
      "Lucca è il servizio toscano più semplice. Le mura rinascimentali sono quattro chilometri di passeggiata verde sopra i tetti, l'ovale di Piazza dell'Anfiteatro ricalca l'arena romana nelle case ocra, e il centro è chiuso alle auto: niente interrompe uno scatto. La luce resta lavorabile più a lungo che nei borghi di collina perché le strade sono larghe e gli edifici bassi. Va benissimo per famiglie e gruppi di più generazioni che vogliono camminare piano, e per le coppie che preferiscono un posto vissuto invece che monumentale: qui ci sono biciclette e mercati, non code.",
    seo_title_it: "Fotografo a Lucca — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Lucca. Servizi di coppia, famiglia e ritratto sulle mura, in Piazza dell'Anfiteatro e nel centro storico.",
    name_de: "Lucca",
    description_de:
      "Eine Stadtmauer als grüne Promenade, schattige Plätze und kein Autoverkehr.",
    name_fr: "Lucques",
    description_fr:
      "Une ville close que l'on parcourt sur ses remparts, pleine de places ombragées et sans aucune voiture.",
  },

  // ──────────────────────────── Veneto ─────────────────────────────
  {
    id: "venice",
    slug: "venice",
    name: "Venice",
    region: "Veneto",
    description:
      "Water, marble and fog — a city that only gives its best pictures before the first vaporetto fills up.",
    long_description:
      "Venice at seven in the morning is a different city from Venice at noon. The Piazza San Marco is empty, the light comes in flat across the lagoon, and the reflections in the smaller canals are unbroken. That hour is what a session here buys you. From the Accademia bridge to the Zattere the water opens up; in Dorsoduro and Cannaregio the lanes are quiet all day and the laundry, brickwork and small bridges do the work. Autumn and winter bring mist that turns the whole city into a soft grey studio — the most flattering conditions of the year, and the least crowded.",
    cover_image: "/images/locations/venice-cover.jpg",
    gallery_images: [],
    lat: 45.4408,
    lng: 12.3155,
    photographer_count: 0,
    seo_title: "Photographer in Venice — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Venice. Couples, proposal and honeymoon photoshoots at St Mark's Square, the Grand Canal, Dorsoduro and Burano.",
    name_it: "Venezia",
    description_it:
      "Acqua, marmo e nebbia: una città che regala le foto migliori prima che si riempia il primo vaporetto.",
    long_description_it:
      "Venezia alle sette del mattino è un'altra città rispetto a mezzogiorno. Piazza San Marco è vuota, la luce arriva piatta dalla laguna e i riflessi nei rii minori sono intatti. Quell'ora è ciò che si compra con un servizio qui. Dal ponte dell'Accademia alle Zattere l'acqua si apre; a Dorsoduro e Cannaregio le calli restano tranquille tutto il giorno e ci pensano i panni stesi, i mattoni e i ponticelli. Autunno e inverno portano la nebbia che trasforma la città in uno studio grigio e morbido: le condizioni più generose dell'anno e le meno affollate.",
    seo_title_it: "Fotografo a Venezia — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Venezia. Servizi di coppia, proposta di matrimonio e viaggio di nozze a San Marco, Dorsoduro, Canal Grande e Burano.",
    name_de: "Venedig",
    description_de:
      "Wasser, Marmor und Nebel — eine Stadt, die ihre besten Bilder vor dem ersten vollen Vaporetto hergibt.",
    seo_title_de: "Fotograf in Venedig — Shooting buchen",
    seo_description_de:
      "Buchen Sie einen professionellen Fotografen in Venedig. Paare, Heiratsanträge und Flitterwochen am Markusplatz, im Dorsoduro und auf Burano.",
    name_fr: "Venise",
    description_fr:
      "L'eau, le marbre et la brume — une ville qui ne livre ses meilleures images qu'avant le premier vaporetto plein.",
    seo_title_fr: "Photographe à Venise — séance photo",
    seo_description_fr:
      "Réservez un photographe professionnel à Venise. Séances couple, demande en mariage et lune de miel place Saint-Marc, à Dorsoduro et à Burano.",
  },
  {
    id: "verona",
    slug: "verona",
    name: "Verona",
    region: "Veneto",
    description:
      "Pink marble, a Roman arena and a river bend — the most romantic small city in the north, and rarely crowded.",
    long_description:
      "Verona is built from a local pink limestone that makes almost every wall behave like a warm reflector, which is why portraits here need so little help. The Arena anchors the centre, Piazza delle Erbe stays busy and colourful, and Castelvecchio's bridge gives clean brick arches over the Adige. Climb to Castel San Pietro for the view that puts the river, the roofs and the hills in one frame at sunset. It is an hour and a half from Venice and far less crowded, which makes it the practical choice for couples who want the Veneto without the queues.",
    cover_image: "/images/locations/verona-cover.jpg",
    gallery_images: [],
    lat: 45.4384,
    lng: 10.9916,
    photographer_count: 0,
    seo_title: "Photographer in Verona — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Verona. Couples, proposal and family photoshoots at the Arena, Castelvecchio bridge and Castel San Pietro.",
    name_it: "Verona",
    description_it:
      "Marmo rosa, un'arena romana e un'ansa di fiume: la piccola città più romantica del nord, e quasi mai affollata.",
    long_description_it:
      "Verona è fatta di un calcare rosa locale che rende quasi ogni muro un pannello riflettente caldo: per questo i ritratti qui hanno bisogno di pochissimo aiuto. L'Arena tiene il centro, Piazza delle Erbe resta viva e colorata, e il ponte di Castelvecchio offre archi di mattone puliti sull'Adige. Si sale a Castel San Pietro per la vista che al tramonto mette fiume, tetti e colline in un'unica inquadratura. È a un'ora e mezza da Venezia e molto meno affollata: la scelta pratica per le coppie che vogliono il Veneto senza le code.",
    seo_title_it: "Fotografo a Verona — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Verona. Servizi di coppia, proposta e famiglia all'Arena, al ponte di Castelvecchio e a Castel San Pietro.",
    name_de: "Verona",
    description_de:
      "Rosa Marmor, eine römische Arena und eine Flussschleife — die romantischste kleine Stadt des Nordens.",
    name_fr: "Vérone",
    description_fr:
      "Marbre rose, arènes romaines et méandre du fleuve — la plus romantique des petites villes du Nord.",
  },
  {
    id: "lake-garda",
    slug: "lake-garda",
    name: "Lake Garda",
    region: "Veneto",
    description:
      "Lemon terraces, cypress headlands and a lake that turns silver at dusk, with the Alps closing the horizon.",
    long_description:
      "Garda gives a photographer two very different lakes. The southern end around Sirmione is wide, warm and Mediterranean — olive groves, thermal water, a castle sitting in the lake itself. The northern end past Limone narrows into fjord country, with cliffs dropping straight into the water and mountain light that changes by the minute. Malcesine's castle terrace and the promenades at Riva del Garda are the reliable sunset positions. It suits honeymooners and families equally: the water is calm, the towns are small, and nothing requires a long walk.",
    cover_image: "/images/locations/lake-garda-cover.jpg",
    gallery_images: [],
    lat: 45.6389,
    lng: 10.6892,
    photographer_count: 0,
    seo_title: "Photographer at Lake Garda — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer at Lake Garda. Couples, honeymoon and family photoshoots in Sirmione, Malcesine, Limone and Riva del Garda.",
    name_it: "Lago di Garda",
    description_it:
      "Limonaie, promontori di cipressi e un lago che al crepuscolo diventa argento, con le Alpi a chiudere l'orizzonte.",
    long_description_it:
      "Il Garda offre due laghi diversi. A sud, attorno a Sirmione, è largo, caldo, mediterraneo: uliveti, acque termali, un castello che sta dentro l'acqua. A nord, oltre Limone, si stringe in un paesaggio da fiordo, con pareti che cadono a picco e una luce di montagna che cambia di minuto in minuto. La terrazza del castello di Malcesine e le passeggiate di Riva del Garda sono le posizioni sicure per il tramonto. Va bene per i viaggi di nozze come per le famiglie: acqua calma, paesi piccoli, niente che richieda lunghe camminate.",
    seo_title_it: "Fotografo sul Lago di Garda — prenota un servizio",
    seo_description_it:
      "Prenota un fotografo professionista sul Lago di Garda. Servizi di coppia, viaggio di nozze e famiglia a Sirmione, Malcesine, Limone e Riva del Garda.",
    name_de: "Gardasee",
    description_de:
      "Zitronenterrassen, Zypressenkaps und ein See, der in der Dämmerung silbern wird — dahinter die Alpen.",
    name_fr: "Lac de Garde",
    description_fr:
      "Terrasses de citronniers, caps de cyprès et un lac qui vire à l'argent au crépuscule, les Alpes en fond.",
  },

  // ─────────────────────────── Lombardy ────────────────────────────
  {
    id: "milan",
    slug: "milan",
    name: "Milan",
    region: "Lombardy",
    description:
      "Gothic marble, glass arcades and courtyards behind every door — a city that photographs sharp rather than soft.",
    long_description:
      "Milan is the northern counterweight to Rome: less golden, more graphic. The Duomo's marble and the Galleria's glass vault carry a session on their own, and the rooftop terraces of the cathedral put you above the city among the spires. Brera gives narrow, ivy-hung lanes; the Navigli give water, iron bridges and reflections at dusk; CityLife and Porta Nuova give clean modern lines for anyone who does not want a postcard. It is also the easiest Italian city to reach and to move around, which matters for a short trip or a business visit with an evening free.",
    cover_image: "/images/locations/milan-cover.jpg",
    gallery_images: [],
    lat: 45.4642,
    lng: 9.1900,
    photographer_count: 0,
    seo_title: "Photographer in Milan — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Milan. Couples, family, solo and business photoshoots at the Duomo, the Galleria, Brera and the Navigli.",
    name_it: "Milano",
    description_it:
      "Marmo gotico, gallerie di vetro e cortili dietro ogni portone: una città che si fotografa netta, non morbida.",
    long_description_it:
      "Milano è il contrappeso settentrionale a Roma: meno dorata, più grafica. Il marmo del Duomo e la volta di vetro della Galleria reggono da soli un servizio, e le terrazze della cattedrale portano sopra la città, tra le guglie. Brera dà vicoli stretti e edera, i Navigli acqua, ponti di ferro e riflessi al crepuscolo, CityLife e Porta Nuova linee moderne pulite per chi non vuole la cartolina. È anche la città italiana più facile da raggiungere e da girare: conta, se il viaggio è breve o se è una trasferta di lavoro con una sera libera.",
    seo_title_it: "Fotografo a Milano — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Milano. Servizi di coppia, famiglia, ritratto e business al Duomo, in Galleria, a Brera e sui Navigli.",
    name_de: "Mailand",
    description_de:
      "Gotischer Marmor, Glasgalerien und Innenhöfe hinter jedem Tor — eine Stadt, die scharf statt weich fotografiert.",
    name_fr: "Milan",
    description_fr:
      "Marbre gothique, galeries de verre et cours cachées derrière chaque porte — une ville nette plutôt que douce.",
  },
  {
    id: "lake-como",
    slug: "lake-como",
    name: "Lake Como",
    region: "Lombardy",
    description:
      "Villas, terraced gardens and mountains straight out of the water — the honeymoon backdrop everyone recognises.",
    long_description:
      "Como is the most photogenic of the Italian lakes because the mountains start where the water stops: there is no shoreline flatland to dilute the frame. Varenna's waterfront lanes and the Villa Monastero gardens are the classic morning session; Bellagio's stepped alleys and the point where the two arms of the lake meet carry the afternoon. Villa del Balbianello, on its wooded promontory, is the single most requested proposal location on the lake and needs booking ahead. Getting between towns is by ferry, which is slow and lovely — plan two hours if you want more than one village.",
    cover_image: "/images/locations/lake-como-cover.jpg",
    gallery_images: [],
    lat: 45.9856,
    lng: 9.2572,
    photographer_count: 0,
    seo_title: "Photographer at Lake Como — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer at Lake Como. Couples, proposal and honeymoon photoshoots in Bellagio, Varenna, Menaggio and the lakeside villas.",
    name_it: "Lago di Como",
    description_it:
      "Ville, giardini a terrazze e montagne che escono dall'acqua: lo sfondo da viaggio di nozze che tutti riconoscono.",
    long_description_it:
      "Como è il più fotogenico dei laghi italiani perché la montagna comincia dove finisce l'acqua: non c'è pianura a diluire l'inquadratura. Le calli sul lago di Varenna e i giardini di Villa Monastero sono il servizio classico del mattino; i vicoli a gradini di Bellagio e la punta dove si incontrano i due rami reggono il pomeriggio. Villa del Balbianello, sul suo promontorio boscoso, è il luogo più richiesto del lago per le proposte di matrimonio e va prenotata per tempo. Tra i paesi ci si muove in traghetto, lento e bellissimo: se volete più di un borgo, prevedete due ore.",
    seo_title_it: "Fotografo sul Lago di Como — prenota un servizio",
    seo_description_it:
      "Prenota un fotografo professionista sul Lago di Como. Servizi di coppia, proposta e viaggio di nozze a Bellagio, Varenna, Menaggio e nelle ville.",
    name_de: "Comer See",
    description_de:
      "Villen, Terrassengärten und Berge direkt aus dem Wasser — die Flitterwochenkulisse, die jeder kennt.",
    name_fr: "Lac de Côme",
    description_fr:
      "Villas, jardins en terrasses et montagnes sortant de l'eau — le décor de lune de miel que tout le monde reconnaît.",
  },

  // ─────────────────────────── Campania ────────────────────────────
  {
    id: "naples",
    slug: "naples",
    name: "Naples",
    region: "Campania",
    description:
      "Loud, layered and cinematic — laundry lines, sea light and Vesuvius closing every view to the south.",
    long_description:
      "Naples photographs like nowhere else in Italy: it is dense, unposed and full of life, and it rewards a documentary approach far more than a monumental one. The Spanish Quarter gives narrow streets, scooters and washing strung between balconies; the Lungomare at Chiaia gives a wide sea horizon with Vesuvius behind; Posillipo looks back over the whole bay at sunset. Come for the atmosphere rather than the landmark — the best Naples pictures have a market, a doorway or a family in them, and the city supplies all three without arranging anything.",
    cover_image: "/images/locations/naples-cover.jpg",
    gallery_images: [],
    lat: 40.8518,
    lng: 14.2681,
    photographer_count: 0,
    seo_title: "Photographer in Naples — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Naples. Couples, family and solo photoshoots in the Spanish Quarter, along the Lungomare and above the bay at Posillipo.",
    name_it: "Napoli",
    description_it:
      "Rumorosa, stratificata, cinematografica: panni stesi, luce di mare e il Vesuvio a chiudere ogni vista a sud.",
    long_description_it:
      "Napoli si fotografa come nessun'altra città italiana: è densa, non in posa, piena di vita, e premia molto più uno sguardo documentario che uno monumentale. I Quartieri Spagnoli danno vicoli, motorini e bucato steso tra i balconi; il lungomare di Chiaia un orizzonte di mare largo con il Vesuvio dietro; Posillipo, al tramonto, riguarda tutto il golfo. Si viene per l'atmosfera più che per il monumento: le foto migliori di Napoli hanno dentro un mercato, un portone o una famiglia, e la città li offre senza che si debba organizzare nulla.",
    seo_title_it: "Fotografo a Napoli — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Napoli. Servizi di coppia, famiglia e ritratto ai Quartieri Spagnoli, sul lungomare e a Posillipo.",
    name_de: "Neapel",
    description_de:
      "Laut, vielschichtig, filmisch — Wäscheleinen, Meerlicht und der Vesuv am südlichen Horizont.",
    name_fr: "Naples",
    description_fr:
      "Bruyante, stratifiée, cinématographique — fils à linge, lumière marine et le Vésuve fermant l'horizon.",
  },
  {
    id: "amalfi-coast",
    slug: "amalfi-coast",
    name: "Amalfi Coast",
    region: "Campania",
    description:
      "Pastel villages stacked on cliffs above blue water — the most requested honeymoon backdrop in Italy.",
    long_description:
      "The Amalfi Coast is a single winding road with a photograph at every bend. Amalfi itself gives the cathedral steps and a working harbour, Atrani next door is quieter and prettier, and the terraces above Conca dei Marini look straight down onto the water. Light is the thing to plan around: the cliffs face south and east, so mornings are luminous and late afternoons fall into shadow early. Sessions here move by car and the road is slow in summer — one village done well beats three done in a hurry.",
    cover_image: "/images/locations/amalfi-coast-cover.jpg",
    gallery_images: [],
    lat: 40.6340,
    lng: 14.6027,
    photographer_count: 0,
    seo_title: "Photographer on the Amalfi Coast — Book a Photoshoot",
    seo_description:
      "Book a professional photographer on the Amalfi Coast. Couples, proposal and honeymoon photoshoots in Amalfi, Atrani, Ravello and Positano.",
    name_it: "Costiera Amalfitana",
    description_it:
      "Paesi pastello incastrati nella roccia sopra l'acqua blu: lo sfondo più richiesto d'Italia per i viaggi di nozze.",
    long_description_it:
      "La Costiera è una sola strada a tornanti con una fotografia a ogni curva. Amalfi dà la scalinata del Duomo e un porto vero, Atrani accanto è più quieta e più bella, e le terrazze sopra Conca dei Marini guardano a picco sull'acqua. La luce va programmata: le falesie sono esposte a sud e a est, quindi la mattina è luminosa e il tardo pomeriggio va presto in ombra. Qui ci si sposta in auto e d'estate la strada è lenta: un paese fatto bene vale più di tre fatti di corsa.",
    seo_title_it: "Fotografo in Costiera Amalfitana — prenota un servizio",
    seo_description_it:
      "Prenota un fotografo professionista in Costiera Amalfitana. Servizi di coppia, proposta e viaggio di nozze ad Amalfi, Atrani, Ravello e Positano.",
    name_de: "Amalfiküste",
    description_de:
      "Pastellfarbene Dörfer über blauem Wasser — Italiens meistgefragte Flitterwochenkulisse.",
    name_fr: "Côte amalfitaine",
    description_fr:
      "Des villages pastel accrochés aux falaises au-dessus de l'eau bleue — le décor de lune de miel le plus demandé d'Italie.",
  },
  {
    id: "positano",
    slug: "positano",
    name: "Positano",
    region: "Campania",
    description:
      "A vertical village of pink and ochre houses tumbling to a pebble beach, best shot from the water.",
    long_description:
      "Positano is the picture everyone has already seen, and it still works: houses stacked in pink, peach and ochre down a ravine to the sea, with the dome of Santa Maria Assunta in the middle. The classic frame is from the Spiaggia Grande looking back up, or from a boat just offshore. The stepped lanes above the church are quieter and give bougainvillea, arches and washing lines. Everything here involves stairs — hundreds of them — so it suits couples and honeymooners more than families with a pushchair.",
    cover_image: "/images/locations/positano-cover.jpg",
    gallery_images: [],
    lat: 40.6281,
    lng: 14.4850,
    photographer_count: 0,
    seo_title: "Photographer in Positano — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Positano. Couples, proposal and honeymoon photoshoots on the Spiaggia Grande, the stepped lanes and by boat.",
    name_it: "Positano",
    description_it:
      "Un paese verticale di case rosa e ocra che scende fino alla spiaggia di ciottoli: si fotografa al meglio dall'acqua.",
    long_description_it:
      "Positano è l'immagine che tutti hanno già visto, e funziona ancora: case impilate in rosa, pesca e ocra lungo un vallone fino al mare, con la cupola di Santa Maria Assunta al centro. L'inquadratura classica è dalla Spiaggia Grande verso l'alto, o da una barca poco al largo. I vicoli a gradini sopra la chiesa sono più tranquilli e regalano bouganville, archi e panni stesi. Qui è tutto scale — centinaia — quindi è più adatto a coppie e viaggi di nozze che a famiglie con passeggino.",
    seo_title_it: "Fotografo a Positano — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Positano. Servizi di coppia, proposta e viaggio di nozze sulla Spiaggia Grande, nei vicoli e in barca.",
    name_de: "Positano",
    description_de:
      "Ein senkrechtes Dorf aus rosa und ockerfarbenen Häusern bis zum Kiesstrand — am besten vom Wasser aus.",
    name_fr: "Positano",
    description_fr:
      "Un village vertical de maisons roses et ocre dévalant vers une plage de galets — à photographier depuis l'eau.",
  },
  {
    id: "sorrento",
    slug: "sorrento",
    name: "Sorrento",
    region: "Campania",
    description:
      "Cliff-top terraces, lemon groves and the whole Bay of Naples with Vesuvius on the far side.",
    long_description:
      "Sorrento is the practical base for the whole area, and it photographs better than its reputation suggests. The town sits on a tufa cliff, so almost every terrace looks across the bay to Vesuvius — the Villa Comunale gardens at sunset are the reliable frame. Marina Grande below still works as a fishing village, with painted boats and low walls, and the lanes around Piazza Tasso give lemon trees and tiled doorways. It is flatter and easier than Positano, which makes it the sensible Campania choice for families and for anyone with limited mobility.",
    cover_image: "/images/locations/sorrento-cover.jpg",
    gallery_images: [],
    lat: 40.6263,
    lng: 14.3757,
    photographer_count: 0,
    seo_title: "Photographer in Sorrento — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Sorrento. Couples, family and honeymoon photoshoots at the Villa Comunale, Marina Grande and above the Bay of Naples.",
    name_it: "Sorrento",
    description_it:
      "Terrazze a picco, limoneti e tutto il golfo di Napoli con il Vesuvio dall'altra parte.",
    long_description_it:
      "Sorrento è la base pratica per tutta la zona e si fotografa meglio di quanto la sua fama lasci pensare. La città sta su una rupe di tufo, quindi quasi ogni terrazza guarda il golfo verso il Vesuvio: i giardini della Villa Comunale al tramonto sono l'inquadratura sicura. Marina Grande, sotto, è ancora un borgo di pescatori con barche dipinte e muretti bassi, e i vicoli attorno a Piazza Tasso danno limoni e portoni di maiolica. È più pianeggiante e comoda di Positano: la scelta sensata in Campania per le famiglie e per chi ha difficoltà a camminare.",
    seo_title_it: "Fotografo a Sorrento — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Sorrento. Servizi di coppia, famiglia e viaggio di nozze alla Villa Comunale e a Marina Grande.",
    name_de: "Sorrent",
    description_de:
      "Terrassen über der Steilküste, Zitronenhaine und der ganze Golf von Neapel mit dem Vesuv gegenüber.",
    name_fr: "Sorrente",
    description_fr:
      "Terrasses en haut de falaise, citronneraies et toute la baie de Naples avec le Vésuve en face.",
  },
  {
    id: "capri",
    slug: "capri",
    name: "Capri",
    region: "Campania",
    description:
      "White rock rising out of very blue water, with gardens, sea stacks and no cars in the centre.",
    long_description:
      "Capri is small and dramatic: limestone cliffs, the Faraglioni stacks offshore, and gardens that hang directly over the sea. The Giardini di Augusto and the Belvedere di Tragara are the two frames the island is known for, and both work best early, before the day boats arrive from Naples and Sorrento. Anacapri, higher up and quieter, gives whitewashed lanes and the chairlift to Monte Solaro. Everything is walked or taken by open taxi, and the light off the water is strong enough that a midday session is genuinely possible here.",
    cover_image: "/images/locations/capri-cover.jpg",
    gallery_images: [],
    lat: 40.5532,
    lng: 14.2222,
    photographer_count: 0,
    seo_title: "Photographer in Capri — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer on Capri. Couples, proposal and honeymoon photoshoots at the Giardini di Augusto, Belvedere di Tragara and in Anacapri.",
    name_it: "Capri",
    description_it:
      "Roccia bianca che esce da un'acqua bluissima, con giardini, faraglioni e nessuna auto in centro.",
    long_description_it:
      "Capri è piccola e teatrale: falesie di calcare, i Faraglioni al largo e giardini che stanno sospesi sul mare. I Giardini di Augusto e il Belvedere di Tragara sono le due inquadrature per cui l'isola è conosciuta, e rendono al meglio presto, prima che arrivino i battelli da Napoli e Sorrento. Anacapri, più in alto e più tranquilla, dà stradine bianche e la seggiovia per il Monte Solaro. Ci si muove a piedi o in taxi scoperto, e la luce riflessa dall'acqua è così forte che qui un servizio a mezzogiorno è davvero possibile.",
    seo_title_it: "Fotografo a Capri — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Capri. Servizi di coppia, proposta e viaggio di nozze ai Giardini di Augusto, a Tragara e ad Anacapri.",
    name_de: "Capri",
    description_de:
      "Weißer Fels über sehr blauem Wasser, Gärten, Faraglioni — und keine Autos im Zentrum.",
    name_fr: "Capri",
    description_fr:
      "Roche blanche sortant d'une eau très bleue, jardins suspendus, faraglioni et aucune voiture au centre.",
  },
  {
    id: "ravello",
    slug: "ravello",
    name: "Ravello",
    region: "Campania",
    description:
      "The Amalfi Coast seen from above — garden terraces a thousand feet up, and far fewer people.",
    long_description:
      "Ravello sits high above Amalfi and trades the harbour for the view. Villa Rufolo's cloister and the Terrace of Infinity at Villa Cimbrone are among the most photographed spots in southern Italy, and both are gardens rather than streets, so a session here is calm and unhurried. Because it is a bus or taxi ride up from the coast road, day-trippers thin out sharply after five, and the late light on the terraces is the reason to stay. It is the coast's best choice for a proposal that needs quiet and a horizon.",
    cover_image: "/images/locations/ravello-cover.jpg",
    gallery_images: [],
    lat: 40.6493,
    lng: 14.6114,
    photographer_count: 0,
    seo_title: "Photographer in Ravello — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Ravello. Couples, proposal and honeymoon photoshoots at Villa Rufolo, Villa Cimbrone and the Terrace of Infinity.",
    name_it: "Ravello",
    description_it:
      "La Costiera vista dall'alto: terrazze di giardini a trecento metri e molta meno gente.",
    long_description_it:
      "Ravello sta in alto sopra Amalfi e scambia il porto con la vista. Il chiostro di Villa Rufolo e la Terrazza dell'Infinito di Villa Cimbrone sono tra i luoghi più fotografati del sud Italia, e sono giardini più che strade: il servizio qui è calmo, senza fretta. Poiché ci si arriva in bus o taxi dalla strada costiera, dopo le cinque i visitatori di giornata calano di colpo, e la luce tarda sulle terrazze è il motivo per restare. È la scelta migliore della Costiera per una proposta di matrimonio che vuole silenzio e orizzonte.",
    seo_title_it: "Fotografo a Ravello — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Ravello. Servizi di coppia, proposta e viaggio di nozze a Villa Rufolo e alla Terrazza dell'Infinito.",
    name_de: "Ravello",
    description_de:
      "Die Amalfiküste von oben — Gartenterrassen in dreihundert Metern Höhe und deutlich weniger Menschen.",
    name_fr: "Ravello",
    description_fr:
      "La côte amalfitaine vue d'en haut — terrasses de jardins à trois cents mètres et beaucoup moins de monde.",
  },

  // ───────────────────────────── Sicily ────────────────────────────
  {
    id: "taormina",
    slug: "taormina",
    name: "Taormina",
    region: "Sicily",
    description:
      "A Greek theatre with Etna behind it, above a bay that turns turquoise by ten in the morning.",
    long_description:
      "Taormina has the most theatrical single backdrop in Sicily: the ancient theatre framed against Mount Etna, often with a plume of smoke. Below it the town is a balcony — Piazza IX Aprile looks straight out over the Ionian, and the public gardens give bougainvillea and shade at any hour. Isola Bella, the tiny island at the bottom of the cable car, is the beach frame. Spring and autumn are the seasons: in August the town is at capacity and the light is hard until quite late.",
    cover_image: "/images/locations/taormina-cover.jpg",
    gallery_images: [],
    lat: 37.8516,
    lng: 15.2853,
    photographer_count: 0,
    seo_title: "Photographer in Taormina, Sicily — Book a Photoshoot",
    seo_description:
      "Book a professional photographer in Taormina. Couples, proposal and family photoshoots at the Greek theatre, Piazza IX Aprile and Isola Bella.",
    name_it: "Taormina",
    description_it:
      "Un teatro greco con l'Etna alle spalle, sopra una baia che entro le dieci del mattino diventa turchese.",
    long_description_it:
      "Taormina ha lo sfondo più teatrale della Sicilia: il teatro antico incorniciato sull'Etna, spesso con il pennacchio di fumo. Sotto, il paese è un balcone — Piazza IX Aprile guarda dritto sullo Ionio, e la villa comunale dà bouganville e ombra a ogni ora. Isola Bella, l'isolotto ai piedi della funivia, è l'inquadratura di mare. Le stagioni giuste sono primavera e autunno: ad agosto il paese è al completo e la luce resta dura fino a tardi.",
    seo_title_it: "Fotografo a Taormina — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Taormina. Servizi di coppia, proposta e famiglia al teatro greco, in Piazza IX Aprile e a Isola Bella.",
    name_de: "Taormina",
    description_de:
      "Ein griechisches Theater mit dem Ätna dahinter, über einer Bucht, die vormittags türkis wird.",
    name_fr: "Taormine",
    description_fr:
      "Un théâtre grec avec l'Etna en fond, au-dessus d'une baie qui vire au turquoise dès dix heures.",
  },
  {
    id: "palermo",
    slug: "palermo",
    name: "Palermo",
    region: "Sicily",
    description:
      "Arab-Norman domes, baroque decay and street markets that photograph like a film set.",
    long_description:
      "Palermo rewards curiosity rather than a checklist. The Quattro Canti and the Martorana give gold mosaics and baroque stone; the Ballarò and Vucciria markets give noise, produce and faces; and the crumbling palazzo courtyards off Via Maqueda give the light that photographers actually come for. The Foro Italico opens onto the sea for a wide, uncluttered sunset. It is a city for documentary and street portraits — bring one location for polish and let the rest be found on the walk between them.",
    cover_image: "/images/locations/palermo-cover.jpg",
    gallery_images: [],
    lat: 38.1157,
    lng: 13.3615,
    photographer_count: 0,
    seo_title: "Photographer in Palermo — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Palermo. Couples, family and solo photoshoots at the Quattro Canti, Ballarò market and the Foro Italico.",
    name_it: "Palermo",
    description_it:
      "Cupole arabo-normanne, barocco che si sfalda e mercati che si fotografano come un set.",
    long_description_it:
      "Palermo premia la curiosità più della lista dei monumenti. I Quattro Canti e la Martorana danno mosaici d'oro e pietra barocca; Ballarò e la Vucciria rumore, banchi e volti; e i cortili dei palazzi scrostati dietro via Maqueda danno la luce per cui i fotografi vengono davvero. Il Foro Italico si apre sul mare per un tramonto ampio e pulito. È una città da reportage e ritratto di strada: si sceglie un luogo per la parte curata e il resto si trova camminando.",
    seo_title_it: "Fotografo a Palermo — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Palermo. Servizi di coppia, famiglia e ritratto ai Quattro Canti, a Ballarò e al Foro Italico.",
    name_de: "Palermo",
    description_de:
      "Arabo-normannische Kuppeln, verfallender Barock und Märkte wie ein Filmset.",
    name_fr: "Palerme",
    description_fr:
      "Coupoles arabo-normandes, baroque écaillé et marchés qui se photographient comme un décor de cinéma.",
  },
  {
    id: "syracuse",
    slug: "syracuse",
    name: "Syracuse",
    region: "Sicily",
    description:
      "Ortigia — an island of honey-coloured baroque, sea on three sides and light that lasts all evening.",
    long_description:
      "Syracuse's old town, Ortigia, is an island joined by two bridges, which means the sea is never more than three streets away. The Piazza del Duomo is a single sheet of pale limestone that acts as an enormous reflector at golden hour, the Fonte Aretusa gives papyrus and water, and the lungomare along the Alfeo wall catches the last light straight on. It is smaller and calmer than Palermo and far less booked than Taormina, which makes it the quiet-luxury choice in Sicily for couples and honeymoons.",
    cover_image: "/images/locations/syracuse-cover.jpg",
    gallery_images: [],
    lat: 37.0596,
    lng: 15.2933,
    photographer_count: 0,
    seo_title: "Photographer in Syracuse & Ortigia — Book a Photoshoot",
    seo_description:
      "Book a professional photographer in Syracuse. Couples, proposal and honeymoon photoshoots in Ortigia, Piazza del Duomo and along the seafront.",
    name_it: "Siracusa",
    description_it:
      "Ortigia: un'isola di barocco color miele, mare su tre lati e una luce che dura tutta la sera.",
    long_description_it:
      "Il centro storico di Siracusa, Ortigia, è un'isola unita da due ponti: il mare non è mai a più di tre strade. Piazza del Duomo è una lastra unica di pietra chiara che all'ora d'oro funziona da riflettore gigante, la Fonte Aretusa dà papiri e acqua, e il lungomare Alfeo prende l'ultima luce di taglio. È più piccola e più calma di Palermo e molto meno prenotata di Taormina: in Sicilia è la scelta di lusso silenzioso per coppie e viaggi di nozze.",
    seo_title_it: "Fotografo a Siracusa — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Siracusa. Servizi di coppia, proposta e viaggio di nozze a Ortigia, in Piazza del Duomo e sul lungomare.",
    name_de: "Syrakus",
    description_de:
      "Ortigia — eine Insel aus honigfarbenem Barock, Meer auf drei Seiten, Licht bis in den Abend.",
    name_fr: "Syracuse",
    description_fr:
      "Ortygie — une île de baroque couleur miel, la mer sur trois côtés et une lumière qui dure toute la soirée.",
  },

  // ─────────────────────────── Liguria ─────────────────────────────
  {
    id: "cinque-terre",
    slug: "cinque-terre",
    name: "Cinque Terre",
    region: "Liguria",
    description:
      "Five painted villages pinned to a cliff coast, linked by footpaths and a train that runs every twenty minutes.",
    long_description:
      "The Cinque Terre gives more colour per frame than anywhere else in Italy: houses in apricot, rose and green stacked above tiny harbours. Manarola seen from the Nessun Dorma terrace at dusk is the postcard, Vernazza's curved harbour is the one to shoot from the castle path, and Riomaggiore's main street runs straight down to the water. Everything involves stairs and the villages are small, so sessions work best just after sunrise or in the last hour of light, when the day-trippers are on the train and the harbours are empty.",
    cover_image: "/images/locations/cinque-terre-cover.jpg",
    gallery_images: [],
    lat: 44.1461,
    lng: 9.6540,
    photographer_count: 0,
    seo_title: "Photographer in Cinque Terre — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in the Cinque Terre. Couples, proposal and honeymoon photoshoots in Manarola, Vernazza and Riomaggiore.",
    name_it: "Cinque Terre",
    description_it:
      "Cinque paesi dipinti aggrappati a una costa di roccia, uniti da sentieri e da un treno ogni venti minuti.",
    long_description_it:
      "Le Cinque Terre danno più colore per inquadratura di qualunque altro posto in Italia: case albicocca, rosa e verdi impilate sopra porticcioli minuscoli. Manarola vista dalla terrazza di Nessun Dorma al crepuscolo è la cartolina, il porto curvo di Vernazza si fotografa dal sentiero del castello, e la via principale di Riomaggiore scende dritta all'acqua. È tutto scale e i paesi sono piccoli: il servizio riesce meglio subito dopo l'alba o nell'ultima ora di luce, quando i visitatori di giornata sono sul treno e i porti sono vuoti.",
    seo_title_it: "Fotografo alle Cinque Terre — prenota un servizio",
    seo_description_it:
      "Prenota un fotografo professionista alle Cinque Terre. Servizi di coppia, proposta e viaggio di nozze a Manarola, Vernazza e Riomaggiore.",
    name_de: "Cinque Terre",
    description_de:
      "Fünf bunte Dörfer an einer Steilküste, verbunden durch Wanderwege und einen Zug alle zwanzig Minuten.",
    name_fr: "Cinque Terre",
    description_fr:
      "Cinq villages colorés accrochés à une côte escarpée, reliés par des sentiers et un train toutes les vingt minutes.",
  },
  {
    id: "portofino",
    slug: "portofino",
    name: "Portofino",
    region: "Liguria",
    description:
      "A tiny harbour of ochre facades and moored boats, with pine woods and a lighthouse walk above it.",
    long_description:
      "Portofino is one small piazzetta open to the sea, and that is the whole point: the harbour, the painted houses and the boats compose themselves. The walk up past Castello Brown to the lighthouse gives three or four elevated frames over the bay, all in pine shade, and Paraggi's green-blue cove is five minutes away for water. It is expensive and busy at midday in season; a session at first light, when the fishermen are the only people out, is a completely different — and better — place.",
    cover_image: "/images/locations/portofino-cover.jpg",
    gallery_images: [],
    lat: 44.3036,
    lng: 9.2097,
    photographer_count: 0,
    seo_title: "Photographer in Portofino — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Portofino. Couples, proposal and honeymoon photoshoots at the harbour, Castello Brown and Paraggi bay.",
    name_it: "Portofino",
    description_it:
      "Un porticciolo di facciate ocra e barche ormeggiate, con pineta e passeggiata al faro sopra.",
    long_description_it:
      "Portofino è una piazzetta sola aperta sul mare, e sta tutto lì: il porto, le case dipinte e le barche si compongono da sé. La salita oltre Castello Brown fino al faro offre tre o quattro inquadrature dall'alto sulla baia, tutte all'ombra dei pini, e la cala verde-azzurra di Paraggi è a cinque minuti per l'acqua. In stagione a mezzogiorno è cara e affollata; un servizio alla prima luce, quando in giro ci sono solo i pescatori, è un posto completamente diverso — e migliore.",
    seo_title_it: "Fotografo a Portofino — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Portofino. Servizi di coppia, proposta e viaggio di nozze al porticciolo, a Castello Brown e a Paraggi.",
    name_de: "Portofino",
    description_de:
      "Ein winziger Hafen aus ockerfarbenen Fassaden und Booten, darüber Pinienwald und der Weg zum Leuchtturm.",
    name_fr: "Portofino",
    description_fr:
      "Un tout petit port de façades ocre et de bateaux, surplombé de pinèdes et du chemin du phare.",
  },

  // ──────────────────────────── Puglia ─────────────────────────────
  {
    id: "lecce",
    slug: "lecce",
    name: "Lecce",
    region: "Puglia",
    description:
      "Baroque carved from soft golden stone, in a walkable old town that empties out by evening.",
    long_description:
      "Lecce is built from a local limestone soft enough to carve like wood, which is why its baroque is so ornate — and why the whole town glows warm in the evening. Piazza del Duomo is enclosed on three sides and almost theatrical after dark, the Roman amphitheatre sits in the middle of the main square, and the side streets are pale, narrow and quiet. It is the cultural anchor of Puglia and an easy base for the coast: the Adriatic is twenty minutes east, the Ionian forty minutes south.",
    cover_image: "/images/locations/lecce-cover.jpg",
    gallery_images: [],
    lat: 40.3515,
    lng: 18.1750,
    photographer_count: 0,
    seo_title: "Photographer in Lecce, Puglia — Book a Photoshoot",
    seo_description:
      "Book a professional photographer in Lecce. Couples, family and proposal photoshoots in Piazza del Duomo, the baroque old town and the Roman amphitheatre.",
    name_it: "Lecce",
    description_it:
      "Un barocco scolpito in pietra dorata e tenera, in un centro che si gira a piedi e la sera si svuota.",
    long_description_it:
      "Lecce è fatta di una pietra locale tanto tenera da lavorarsi come il legno: per questo il suo barocco è così ricco, e per questo tutta la città la sera diventa calda. Piazza del Duomo è chiusa su tre lati e dopo il tramonto è quasi teatrale, l'anfiteatro romano sta in mezzo alla piazza principale, e le vie laterali sono chiare, strette e silenziose. È il centro culturale della Puglia e una base comoda per la costa: l'Adriatico è venti minuti a est, lo Ionio quaranta a sud.",
    seo_title_it: "Fotografo a Lecce — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista a Lecce. Servizi di coppia, famiglia e proposta in Piazza del Duomo e nel centro barocco.",
    name_de: "Lecce",
    description_de:
      "Barock aus weichem, goldenem Stein in einer Altstadt, die sich abends leert.",
    name_fr: "Lecce",
    description_fr:
      "Un baroque sculpté dans une pierre dorée et tendre, dans un centre piéton qui se vide le soir.",
  },
  {
    id: "alberobello",
    slug: "alberobello",
    name: "Alberobello",
    region: "Puglia",
    description:
      "Whitewashed cones by the thousand — the trulli district, which photographs like nowhere else in Europe.",
    long_description:
      "Alberobello is a single strange, wonderful idea repeated a thousand times: dry-stone houses with conical roofs, whitewashed and packed along two hillsides. The Rione Monti is the busy half and Aia Piccola the quiet one, and both are best before nine or after six, when the white stops being blinding and starts turning cream and pink. Shoot up the stepped lanes for repetition and depth, or from the Belvedere Santa Lucia for the roofscape. Half an hour away, Locorotondo and Ostuni give more white towns if the session runs long.",
    cover_image: "/images/locations/alberobello-cover.jpg",
    gallery_images: [],
    lat: 40.7830,
    lng: 17.2372,
    photographer_count: 0,
    seo_title: "Photographer in Alberobello — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Alberobello. Couples, family and solo photoshoots among the trulli of Rione Monti and Aia Piccola.",
    name_it: "Alberobello",
    description_it:
      "Migliaia di coni imbiancati: il rione dei trulli, che si fotografa come nessun altro posto in Europa.",
    long_description_it:
      "Alberobello è una sola idea strana e meravigliosa ripetuta mille volte: case a secco con il tetto a cono, imbiancate e serrate su due versanti. Il Rione Monti è la metà affollata, Aia Piccola quella tranquilla, e rendono entrambi prima delle nove o dopo le sei, quando il bianco smette di accecare e vira al crema e al rosa. Si fotografa risalendo i vicoli a gradini per ripetizione e profondità, o dal Belvedere Santa Lucia per il panorama dei tetti. A mezz'ora ci sono Locorotondo e Ostuni, altri paesi bianchi, se il servizio si allunga.",
    seo_title_it: "Fotografo ad Alberobello — prenota un servizio fotografico",
    seo_description_it:
      "Prenota un fotografo professionista ad Alberobello. Servizi di coppia, famiglia e ritratto tra i trulli del Rione Monti e di Aia Piccola.",
    name_de: "Alberobello",
    description_de:
      "Tausende weiß gekalkte Kegeldächer — der Trulli-Bezirk, einzigartig in Europa.",
    name_fr: "Alberobello",
    description_fr:
      "Des milliers de cônes blanchis à la chaux — le quartier des trulli, unique en Europe.",
  },
];

import { Location } from "@/types";

/**
 * Spanish locations for the Photo Spain instance (COUNTRY=es).
 *
 * Selection criteria, in order of weight:
 *   1. Volume of international (EN/DE/FR-speaking) leisure tourism — these are
 *      the people who book a vacation photographer.
 *   2. A recognisable backdrop that sells the shoot in one thumbnail.
 *   3. Demand for the four money occasions: couples, proposals, families,
 *      honeymoons.
 *
 * EN and ES are written in full. DE and FR carry names plus a short
 * description; long-form German and French fall back to English at the call
 * site (`loc[`description_${locale}`] || loc.description`), which is the same
 * behaviour the Portuguese dataset relies on.
 *
 * `photographer_count` is seeded at 0 and maintained by the app.
 */
export const locationsES: Location[] = [
  // ─────────────────────────── Catalonia ───────────────────────────
  {
    id: "barcelona",
    slug: "barcelona",
    name: "Barcelona",
    region: "Catalonia",
    description:
      "Gaudí's mosaics, Gothic alleyways and a Mediterranean beach in the same afternoon — Spain's most photogenic city.",
    long_description:
      "Barcelona gives a photographer more backdrops per square kilometre than anywhere else in Spain. Mornings belong to the Gothic Quarter, where narrow stone lanes catch shafts of light and stay quiet before ten. Park Güell and Casa Batlló bring Gaudí's colour and curves, the Bunkers del Carmel deliver the city's best sunset panorama, and Barceloneta closes the day with sea, sand and palm shadows. Couples shoot in the old town, families along the waterfront, and proposals almost always happen on a terrace above the rooftops with the Sagrada Família breaking the skyline.",
    cover_image: "/images/locations/barcelona-cover.jpg",
    gallery_images: [],
    lat: 41.3874,
    lng: 2.1686,
    photographer_count: 0,
    seo_title: "Photographer in Barcelona — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Barcelona. Couples, family, proposal and solo photoshoots at Park Güell, the Gothic Quarter, Bunkers del Carmel and the beach. Verified reviews.",
    name_es: "Barcelona",
    description_es:
      "Mosaicos de Gaudí, callejuelas góticas y playa mediterránea en una misma tarde: la ciudad más fotogénica de España.",
    long_description_es:
      "Barcelona ofrece más escenarios por kilómetro cuadrado que cualquier otra ciudad española. Las mañanas son del Barrio Gótico, donde la luz entra en diagonal entre callejones de piedra que aún están tranquilos antes de las diez. El Park Güell y la Casa Batlló aportan el color y las curvas de Gaudí, los Búnkers del Carmel regalan la mejor panorámica al atardecer, y la Barceloneta cierra el día con mar, arena y sombras de palmeras. Las parejas eligen el casco antiguo, las familias el paseo marítimo, y las pedidas de mano casi siempre ocurren en una azotea con la Sagrada Família recortada en el horizonte.",
    seo_title_es: "Fotógrafo en Barcelona — Reserva tu sesión de fotos profesional",
    seo_description_es:
      "Reserva un fotógrafo profesional en Barcelona. Sesiones de pareja, familia, pedida de mano y solo en el Park Güell, el Barrio Gótico, los Búnkers del Carmel y la playa.",
    name_de: "Barcelona",
    description_de:
      "Gaudís Mosaike, gotische Gassen und Mittelmeerstrand am selben Nachmittag — Spaniens fotogenste Stadt.",
    name_fr: "Barcelone",
    description_fr:
      "Les mosaïques de Gaudí, les ruelles gothiques et une plage méditerranéenne dans le même après-midi — la ville la plus photogénique d'Espagne.",
  },
  {
    id: "sitges",
    slug: "sitges",
    name: "Sitges",
    region: "Catalonia",
    description:
      "A whitewashed seaside town forty minutes from Barcelona, built around a church on the rocks and seventeen beaches.",
    long_description:
      "Sitges is what people picture when they imagine the Catalan coast: white houses, bougainvillea, a promenade lined with palms and the church of Sant Bartomeu standing on a rock above the water. It photographs beautifully in the late afternoon, when the sea turns metallic and the old town empties. The town has long been one of Spain's most welcoming destinations for same-sex couples, and a large share of the weddings and engagement shoots here reflect that. Forty minutes by train from Barcelona makes it an easy second location for a two-city session.",
    cover_image: "/images/locations/sitges-cover.jpg",
    gallery_images: [],
    lat: 41.2371,
    lng: 1.8058,
    photographer_count: 0,
    seo_title: "Photographer in Sitges — Beach & Couple Photoshoots",
    seo_description:
      "Book a professional photographer in Sitges. Couple, engagement and family photoshoots on the promenade, the old town and the beaches, 40 minutes from Barcelona.",
    name_es: "Sitges",
    description_es:
      "Pueblo marinero de casas blancas a cuarenta minutos de Barcelona, con su iglesia sobre la roca y diecisiete playas.",
    long_description_es:
      "Sitges es la imagen que todo el mundo tiene de la costa catalana: casas blancas, buganvillas, un paseo de palmeras y la iglesia de Sant Bartomeu sobre la roca, asomada al agua. Fotografía especialmente bien a última hora de la tarde, cuando el mar se vuelve metálico y el casco antiguo se vacía. Es desde hace décadas uno de los destinos más acogedores de España para parejas del mismo sexo, y buena parte de las bodas y pedidas que se fotografían aquí lo reflejan. A cuarenta minutos en tren de Barcelona, funciona muy bien como segunda localización.",
    seo_title_es: "Fotógrafo en Sitges — Sesiones de pareja y playa",
    seo_description_es:
      "Reserva un fotógrafo profesional en Sitges. Sesiones de pareja, pedida de mano y familia en el paseo marítimo, el casco antiguo y las playas.",
    name_de: "Sitges",
    description_de:
      "Weiß getünchter Küstenort vierzig Minuten von Barcelona, mit der Kirche auf dem Felsen und siebzehn Stränden.",
    name_fr: "Sitges",
    description_fr:
      "Village balnéaire blanchi à la chaux à quarante minutes de Barcelone, avec son église sur le rocher et dix-sept plages.",
  },
  {
    id: "girona",
    slug: "girona",
    name: "Girona",
    region: "Catalonia",
    description:
      "Medieval walls, coloured houses over the river and the cathedral stairway that made the city famous on screen.",
    long_description:
      "Girona is compact, walkable and almost theatrically photogenic. The Onyar houses hang over the water in ochre and rust, the Jewish Quarter is a maze of stone arches that stays cool and shaded at midday, and the cathedral's eighty-six-step staircase gives a shot with genuine scale — the one viewers recognise from television. Walking the medieval walls at the end of the day puts the whole old town and the Pyrenean foothills behind your subjects. It is under forty minutes by high-speed train from Barcelona and the natural base for the Costa Brava.",
    cover_image: "/images/locations/girona-cover.jpg",
    gallery_images: [],
    lat: 41.9794,
    lng: 2.8214,
    photographer_count: 0,
    seo_title: "Photographer in Girona — Old Town & Cathedral Photoshoots",
    seo_description:
      "Book a professional photographer in Girona. Couple, family and solo photoshoots at the cathedral stairway, the Jewish Quarter and the Onyar houses.",
    name_es: "Girona",
    description_es:
      "Murallas medievales, casas de colores sobre el río y la escalinata de la catedral que hizo famosa a la ciudad.",
    long_description_es:
      "Girona es compacta, muy caminable y casi teatralmente fotogénica. Las casas del Onyar cuelgan sobre el agua en tonos ocre y óxido, el Call judío es un laberinto de arcos de piedra que se mantiene fresco y en sombra al mediodía, y la escalinata de la catedral, con sus ochenta y seis peldaños, aporta una escala real a la imagen. Recorrer la muralla al final del día deja todo el casco antiguo y las estribaciones del Pirineo detrás de los protagonistas. Está a menos de cuarenta minutos en AVE desde Barcelona y es la base natural para la Costa Brava.",
    seo_title_es: "Fotógrafo en Girona — Sesiones en el casco antiguo",
    seo_description_es:
      "Reserva un fotógrafo profesional en Girona. Sesiones de pareja, familia y solo en la escalinata de la catedral, el Call judío y las casas del Onyar.",
    name_de: "Girona",
    description_de:
      "Mittelalterliche Mauern, bunte Häuser über dem Fluss und die Kathedralentreppe, die die Stadt berühmt machte.",
    name_fr: "Gérone",
    description_fr:
      "Remparts médiévaux, maisons colorées au-dessus de la rivière et l'escalier de la cathédrale qui a rendu la ville célèbre.",
  },
  {
    id: "costa-brava",
    slug: "costa-brava",
    name: "Costa Brava",
    region: "Catalonia",
    description:
      "Pine-covered cliffs dropping into turquoise coves, with Cadaqués and Tossa de Mar as the two postcard anchors.",
    long_description:
      "The Costa Brava is the rugged half of Catalonia's coastline: umbrella pines growing right to the cliff edge, coves you reach on foot, and water that reads turquoise even in photographs taken from the shore. Tossa de Mar has the walled medieval village above the beach; Cadaqués, further north, is the whitewashed fishing town where Dalí lived, with its bay and church tower. Shoots here are built around a coastal path and the last two hours of light, and they suit couples, honeymooners and anyone who wants the sea rather than a city in the frame.",
    cover_image: "/images/locations/costa-brava-cover.jpg",
    gallery_images: [],
    lat: 41.7211,
    lng: 2.9317,
    photographer_count: 0,
    seo_title: "Photographer on the Costa Brava — Coastal Photoshoots",
    seo_description:
      "Book a professional photographer on the Costa Brava. Couple, honeymoon and family photoshoots in Tossa de Mar, Cadaqués and the hidden coves.",
    name_es: "Costa Brava",
    description_es:
      "Acantilados de pinos que caen sobre calas turquesa, con Cadaqués y Tossa de Mar como las dos postales de referencia.",
    long_description_es:
      "La Costa Brava es la mitad agreste del litoral catalán: pinos que crecen hasta el borde del acantilado, calas a las que solo se llega a pie y un agua que sale turquesa incluso fotografiada desde la orilla. Tossa de Mar tiene el recinto medieval amurallado sobre la playa; Cadaqués, más al norte, es el pueblo pesquero blanco donde vivió Dalí, con su bahía y su campanario. Las sesiones aquí se organizan alrededor de un camino de ronda y de las dos últimas horas de luz, y funcionan muy bien para parejas, lunas de miel y quien quiera mar en lugar de ciudad.",
    seo_title_es: "Fotógrafo en la Costa Brava — Sesiones junto al mar",
    seo_description_es:
      "Reserva un fotógrafo profesional en la Costa Brava. Sesiones de pareja, luna de miel y familia en Tossa de Mar, Cadaqués y las calas.",
    name_de: "Costa Brava",
    description_de:
      "Pinienbewachsene Klippen über türkisen Buchten, mit Cadaqués und Tossa de Mar als den beiden Postkartenmotiven.",
    name_fr: "Costa Brava",
    description_fr:
      "Falaises couvertes de pins plongeant dans des criques turquoise, avec Cadaqués et Tossa de Mar en cartes postales.",
  },

  // ──────────────────────── Community of Madrid ────────────────────────
  {
    id: "madrid",
    slug: "madrid",
    name: "Madrid",
    region: "Community of Madrid",
    description:
      "Grand boulevards, a royal palace and the sunset terrace at Templo de Debod — Spain's capital shoots best in the evening.",
    long_description:
      "Madrid rewards photographers who work late. The city's signature shot is the Templo de Debod at sunset, an Egyptian temple reflected in still water with the whole western sky behind it — which is why most proposals here are timed to the minute. Earlier in the day, the Retiro park gives greenery, the Crystal Palace and a boating lake; Plaza Mayor and the lanes of La Latina give warm stone and balconies; Gran Vía gives the cinematic city. Families like the Retiro, couples like the old town, and the Royal Palace works as a backdrop of pure scale.",
    cover_image: "/images/locations/madrid-cover.jpg",
    gallery_images: [],
    lat: 40.4168,
    lng: -3.7038,
    photographer_count: 0,
    seo_title: "Photographer in Madrid — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Madrid. Couple, family, proposal and solo photoshoots at Templo de Debod, Retiro Park, Plaza Mayor and the Royal Palace.",
    name_es: "Madrid",
    description_es:
      "Grandes avenidas, palacio real y el atardecer del Templo de Debod: la capital se fotografía mejor al caer la tarde.",
    long_description_es:
      "Madrid premia a quien fotografía tarde. La imagen insignia de la ciudad es el Templo de Debod al atardecer, reflejado en el agua quieta con todo el cielo de poniente detrás; por eso aquí las pedidas de mano se cronometran al minuto. Antes, el Retiro aporta verde, el Palacio de Cristal y el estanque; la Plaza Mayor y las calles de La Latina, piedra cálida y balcones; la Gran Vía, la ciudad más cinematográfica. Las familias eligen el Retiro, las parejas el casco antiguo, y el Palacio Real funciona como un fondo de pura escala.",
    seo_title_es: "Fotógrafo en Madrid — Reserva tu sesión de fotos profesional",
    seo_description_es:
      "Reserva un fotógrafo profesional en Madrid. Sesiones de pareja, familia, pedida de mano y solo en el Templo de Debod, el Retiro, la Plaza Mayor y el Palacio Real.",
    name_de: "Madrid",
    description_de:
      "Prachtboulevards, ein Königspalast und der Sonnenuntergang am Templo de Debod — die Hauptstadt fotografiert man am besten abends.",
    name_fr: "Madrid",
    description_fr:
      "Grands boulevards, palais royal et le coucher de soleil du Templo de Debod — la capitale se photographie le soir.",
  },
  {
    id: "toledo",
    slug: "toledo",
    name: "Toledo",
    region: "Community of Madrid",
    description:
      "A walled city on a granite hill above a river bend, thirty minutes by train from Madrid.",
    long_description:
      "Toledo sits on a rock inside a loop of the Tagus, and the classic image is taken from the far bank: the whole medieval city stacked up the hillside, cathedral and fortress on top. Inside the walls it is all narrow lanes, arches and courtyards, with Moorish, Jewish and Christian architecture layered street by street. The stone holds warm colour late into the evening. Half an hour from Madrid by high-speed train, Toledo is the standard second location for visitors who want something older and quieter than the capital.",
    cover_image: "/images/locations/toledo-cover.jpg",
    gallery_images: [],
    lat: 39.8628,
    lng: -4.0273,
    photographer_count: 0,
    seo_title: "Photographer in Toledo — Medieval City Photoshoots",
    seo_description:
      "Book a professional photographer in Toledo. Couple, family and solo photoshoots in the walled old town, 30 minutes from Madrid by train.",
    name_es: "Toledo",
    description_es:
      "Ciudad amurallada sobre un cerro de granito en un meandro del Tajo, a media hora en tren de Madrid.",
    long_description_es:
      "Toledo se asienta sobre una roca dentro de un meandro del Tajo, y la imagen clásica se toma desde la otra orilla: la ciudad medieval entera escalonada en la ladera, con la catedral y el alcázar coronándola. Dentro de las murallas todo son callejones estrechos, arcos y patios, con arquitectura árabe, judía y cristiana superpuesta calle a calle. La piedra conserva un color cálido hasta bien entrada la tarde. A treinta minutos de Madrid en AVE, es la segunda localización habitual para quien busca algo más antiguo y tranquilo que la capital.",
    seo_title_es: "Fotógrafo en Toledo — Sesiones en la ciudad medieval",
    seo_description_es:
      "Reserva un fotógrafo profesional en Toledo. Sesiones de pareja, familia y solo en el casco amurallado, a 30 minutos de Madrid.",
    name_de: "Toledo",
    description_de:
      "Ummauerte Stadt auf einem Granitfelsen über einer Flussschleife, dreißig Minuten von Madrid.",
    name_fr: "Tolède",
    description_fr:
      "Cité fortifiée sur une colline de granit dans un méandre du Tage, à trente minutes de Madrid.",
  },
  {
    id: "segovia",
    slug: "segovia",
    name: "Segovia",
    region: "Community of Madrid",
    description:
      "A Roman aqueduct running straight through town and a castle that looks borrowed from a fairy tale.",
    long_description:
      "Segovia offers two backdrops nobody has to explain. The Roman aqueduct still crosses the centre on 167 arches with no mortar holding it together, and the Alcázar sits on a spur above the confluence of two rivers, all towers and slate spires. Between them the old town is honey-coloured stone and quiet squares. It is under half an hour from Madrid on the fast train, sits higher and cooler than the capital, and the light in the hour before sunset turns the aqueduct's stone genuinely gold.",
    cover_image: "/images/locations/segovia-cover.jpg",
    gallery_images: [],
    lat: 40.9429,
    lng: -4.1088,
    photographer_count: 0,
    seo_title: "Photographer in Segovia — Aqueduct & Alcázar Photoshoots",
    seo_description:
      "Book a professional photographer in Segovia. Couple, family and proposal photoshoots at the Roman aqueduct and the Alcázar, 30 minutes from Madrid.",
    name_es: "Segovia",
    description_es:
      "Un acueducto romano que atraviesa la ciudad y un alcázar que parece sacado de un cuento.",
    long_description_es:
      "Segovia ofrece dos fondos que no necesitan explicación. El acueducto romano sigue cruzando el centro sobre 167 arcos sin una gota de argamasa, y el Alcázar se alza en un espolón sobre la confluencia de dos ríos, todo torres y chapiteles de pizarra. Entre ambos, el casco antiguo es piedra color miel y plazas tranquilas. Está a menos de media hora de Madrid en tren rápido, más alto y más fresco que la capital, y la luz de la última hora vuelve la piedra del acueducto literalmente dorada.",
    seo_title_es: "Fotógrafo en Segovia — Sesiones en el acueducto y el Alcázar",
    seo_description_es:
      "Reserva un fotógrafo profesional en Segovia. Sesiones de pareja, familia y pedida de mano en el acueducto romano y el Alcázar.",
    name_de: "Segovia",
    description_de:
      "Ein römisches Aquädukt mitten durch die Stadt und eine Burg wie aus dem Märchen.",
    name_fr: "Ségovie",
    description_fr:
      "Un aqueduc romain traversant la ville et un alcazar digne d'un conte de fées.",
  },

  // ─────────────────────────── Andalusia ───────────────────────────
  {
    id: "seville",
    slug: "seville",
    name: "Seville",
    region: "Andalusia",
    description:
      "Plaza de España, orange trees and tiled courtyards — the most photographed city in southern Spain.",
    long_description:
      "Seville is the city most couples have already seen before they arrive. The Plaza de España is a semicircle of brick, tile and bridges over a canal, and it carries a shoot on its own. The Real Alcázar adds Moorish arches, water gardens and carved plasterwork; the Santa Cruz quarter adds whitewashed lanes barely wide enough for two people; the Metropol Parasol adds a modern wooden skyline. Orange trees line the streets and the light is warm from March to November. It is the strongest proposal and honeymoon market in Andalusia.",
    cover_image: "/images/locations/seville-cover.jpg",
    gallery_images: [],
    lat: 37.3891,
    lng: -5.9845,
    photographer_count: 0,
    seo_title: "Photographer in Seville — Book a Professional Photoshoot",
    seo_description:
      "Book a professional photographer in Seville. Couple, proposal, family and solo photoshoots at Plaza de España, the Real Alcázar and Santa Cruz.",
    name_es: "Sevilla",
    description_es:
      "Plaza de España, naranjos y patios de azulejos: la ciudad más fotografiada del sur de España.",
    long_description_es:
      "Sevilla es la ciudad que la mayoría de las parejas ya ha visto antes de llegar. La Plaza de España es un semicírculo de ladrillo, azulejo y puentes sobre un canal, y sostiene una sesión entera por sí sola. El Real Alcázar aporta arcos, jardines de agua y yeserías; el barrio de Santa Cruz, callejones encalados por los que apenas pasan dos personas; las Setas, un perfil moderno de madera. Los naranjos jalonan las calles y la luz es cálida de marzo a noviembre. Es el mercado más fuerte de Andalucía para pedidas de mano y lunas de miel.",
    seo_title_es: "Fotógrafo en Sevilla — Reserva tu sesión de fotos profesional",
    seo_description_es:
      "Reserva un fotógrafo profesional en Sevilla. Sesiones de pareja, pedida de mano, familia y solo en la Plaza de España, el Real Alcázar y Santa Cruz.",
    name_de: "Sevilla",
    description_de:
      "Plaza de España, Orangenbäume und gekachelte Innenhöfe — die meistfotografierte Stadt Südspaniens.",
    name_fr: "Séville",
    description_fr:
      "Plaza de España, orangers et patios d'azulejos — la ville la plus photographiée du sud de l'Espagne.",
  },
  {
    id: "granada",
    slug: "granada",
    name: "Granada",
    region: "Andalusia",
    description:
      "The Alhambra on its ridge with the snow of the Sierra Nevada behind it, seen from the whitewashed Albaicín.",
    long_description:
      "Granada's defining frame is taken from the Mirador de San Nicolás: the Alhambra along the opposite ridge, the Sierra Nevada still snow-capped behind it into May, and the sun going down over your subjects' shoulders. It is the reason photographers here work at dusk. The Albaicín below is a hillside of white houses, cypress trees and cobbled switchbacks; Sacromonte adds cave dwellings and a wilder view. The Alhambra's own courtyards require a timed ticket, which any local photographer will tell you to book weeks ahead.",
    cover_image: "/images/locations/granada-cover.jpg",
    gallery_images: [],
    lat: 37.1773,
    lng: -3.5986,
    photographer_count: 0,
    seo_title: "Photographer in Granada — Alhambra & Albaicín Photoshoots",
    seo_description:
      "Book a professional photographer in Granada. Couple, proposal and family photoshoots at Mirador de San Nicolás, the Albaicín and the Alhambra.",
    name_es: "Granada",
    description_es:
      "La Alhambra en su cerro con la nieve de Sierra Nevada al fondo, vista desde el Albaicín encalado.",
    long_description_es:
      "El encuadre que define Granada se toma desde el Mirador de San Nicolás: la Alhambra en la loma de enfrente, Sierra Nevada todavía nevada hasta mayo detrás, y el sol cayendo por encima del hombro de los protagonistas. Por eso aquí se fotografía al anochecer. El Albaicín, más abajo, es una ladera de casas blancas, cipreses y cuestas empedradas; el Sacromonte añade cuevas y una vista más agreste. Los patios de la Alhambra exigen entrada con hora, y cualquier fotógrafo local recomendará reservarla con semanas de antelación.",
    seo_title_es: "Fotógrafo en Granada — Sesiones en la Alhambra y el Albaicín",
    seo_description_es:
      "Reserva un fotógrafo profesional en Granada. Sesiones de pareja, pedida de mano y familia en el Mirador de San Nicolás, el Albaicín y la Alhambra.",
    name_de: "Granada",
    description_de:
      "Die Alhambra auf ihrem Bergrücken mit dem Schnee der Sierra Nevada dahinter, vom weißen Albaicín aus gesehen.",
    name_fr: "Grenade",
    description_fr:
      "L'Alhambra sur sa crête avec les neiges de la Sierra Nevada derrière, vue depuis l'Albaicín blanchi.",
  },
  {
    id: "malaga",
    slug: "malaga",
    name: "Málaga",
    region: "Andalusia",
    description:
      "The gateway to the Costa del Sol: a Moorish fortress above the port, palm-lined streets and three hundred days of sun.",
    long_description:
      "Málaga is where most visitors to southern Spain land, and it has quietly become a destination in its own right. The Alcazaba and the Gibralfaro castle stack up the hill behind the centre and give a view over the port and the bay. The old town is marble-paved and full of small squares; the Muelle Uno promenade and La Malagueta beach carry the seaside half of a session. Because the airport is here and the weather holds through winter, Málaga is often the easiest place in Andalusia to schedule a shoot at short notice.",
    cover_image: "/images/locations/malaga-cover.jpg",
    gallery_images: [],
    lat: 36.7213,
    lng: -4.4214,
    photographer_count: 0,
    seo_title: "Photographer in Málaga — Costa del Sol Photoshoots",
    seo_description:
      "Book a professional photographer in Málaga. Couple, family and solo photoshoots at the Alcazaba, Gibralfaro, the old town and La Malagueta beach.",
    name_es: "Málaga",
    description_es:
      "La puerta de la Costa del Sol: fortaleza árabe sobre el puerto, calles de palmeras y trescientos días de sol.",
    long_description_es:
      "Málaga es donde aterriza la mayoría de quienes visitan el sur de España, y con los años se ha convertido en destino por derecho propio. La Alcazaba y el castillo de Gibralfaro escalonan la colina detrás del centro y regalan una vista del puerto y la bahía. El casco antiguo, de mármol y plazas pequeñas, se combina con el Muelle Uno y la playa de La Malagueta para la parte marítima de la sesión. Como el aeropuerto está aquí y el clima aguanta en invierno, suele ser el punto de Andalucía más fácil para agendar con poca antelación.",
    seo_title_es: "Fotógrafo en Málaga — Sesiones en la Costa del Sol",
    seo_description_es:
      "Reserva un fotógrafo profesional en Málaga. Sesiones de pareja, familia y solo en la Alcazaba, Gibralfaro, el casco antiguo y La Malagueta.",
    name_de: "Málaga",
    description_de:
      "Das Tor zur Costa del Sol: maurische Festung über dem Hafen, Palmenstraßen und dreihundert Sonnentage.",
    name_fr: "Málaga",
    description_fr:
      "La porte de la Costa del Sol : forteresse mauresque au-dessus du port, rues bordées de palmiers et trois cents jours de soleil.",
  },
  {
    id: "marbella",
    slug: "marbella",
    name: "Marbella",
    region: "Andalusia",
    description:
      "Yachts at Puerto Banús, an old town buried in flowers, and the Sierra Blanca standing over both.",
    long_description:
      "Marbella runs on two registers and photographs well in both. Puerto Banús is polished — yachts, palms, glass and evening light on white hulls — and suits clients who want the glamorous version of the coast. Five minutes inland, the Casco Antiguo is the opposite: Orange Square, narrow lanes, whitewash under cascades of geraniums. Behind everything the Sierra Blanca gives the beaches a mountain backdrop that most of the Costa del Sol lacks. Family sessions usually happen on the sand at golden hour; anniversary and honeymoon work tends toward the port.",
    cover_image: "/images/locations/marbella-cover.jpg",
    gallery_images: [],
    lat: 36.5101,
    lng: -4.8825,
    photographer_count: 0,
    seo_title: "Photographer in Marbella — Beach & Old Town Photoshoots",
    seo_description:
      "Book a professional photographer in Marbella. Couple, family and honeymoon photoshoots at Puerto Banús, the old town and the beaches.",
    name_es: "Marbella",
    description_es:
      "Yates en Puerto Banús, un casco antiguo enterrado en flores y la Sierra Blanca sobre ambos.",
    long_description_es:
      "Marbella funciona en dos registros y fotografía bien en los dos. Puerto Banús es el pulido: yates, palmeras, cristal y luz de tarde sobre los cascos blancos, ideal para quien busca la versión glamurosa de la costa. Cinco minutos hacia el interior, el Casco Antiguo es lo contrario: la plaza de los Naranjos, callejones estrechos y cal bajo cascadas de geranios. Detrás de todo, la Sierra Blanca da a las playas un fondo de montaña que falta en casi toda la Costa del Sol. Las familias suelen fotografiarse en la arena a la hora dorada; los aniversarios y lunas de miel, en el puerto.",
    seo_title_es: "Fotógrafo en Marbella — Sesiones en la playa y el casco antiguo",
    seo_description_es:
      "Reserva un fotógrafo profesional en Marbella. Sesiones de pareja, familia y luna de miel en Puerto Banús, el casco antiguo y las playas.",
    name_de: "Marbella",
    description_de:
      "Yachten in Puerto Banús, eine in Blumen versunkene Altstadt und die Sierra Blanca über beidem.",
    name_fr: "Marbella",
    description_fr:
      "Yachts à Puerto Banús, vieille ville noyée sous les fleurs et la Sierra Blanca dominant le tout.",
  },
  {
    id: "ronda",
    slug: "ronda",
    name: "Ronda",
    region: "Andalusia",
    description:
      "A town split by a 120-metre gorge, joined by a stone bridge — the single most dramatic backdrop in Spain.",
    long_description:
      "Ronda delivers one image that no other Spanish town can match: the Puente Nuevo spanning a gorge that drops 120 metres, with houses balanced on the cliff edge above it. Shot from the viewpoints below or from the Jardines de Cuenca opposite, it gives couples a frame with genuine drama and no crowd management problem. The old Moorish quarter behind the bridge is quiet and walkable, and the surrounding countryside of vineyards and white villages opens up in every direction. It is a ninety-minute drive from Málaga and a standard honeymoon stop.",
    cover_image: "/images/locations/ronda-cover.jpg",
    gallery_images: [],
    lat: 36.7402,
    lng: -5.1673,
    photographer_count: 0,
    seo_title: "Photographer in Ronda — Puente Nuevo & Gorge Photoshoots",
    seo_description:
      "Book a professional photographer in Ronda. Couple, proposal and honeymoon photoshoots at the Puente Nuevo, the gorge viewpoints and the old town.",
    name_es: "Ronda",
    description_es:
      "Un pueblo partido por un tajo de 120 metros y unido por un puente de piedra: el fondo más espectacular de España.",
    long_description_es:
      "Ronda ofrece una imagen que ningún otro pueblo español iguala: el Puente Nuevo salvando un tajo de 120 metros, con las casas asomadas al borde del precipicio. Fotografiado desde los miradores de abajo o desde los Jardines de Cuenca, enfrente, da a las parejas un encuadre con verdadera fuerza y sin problemas de gentío. El barrio árabe, detrás del puente, es tranquilo y muy caminable, y alrededor se abre un paisaje de viñedos y pueblos blancos. Está a hora y media en coche de Málaga y es parada habitual en las lunas de miel.",
    seo_title_es: "Fotógrafo en Ronda — Sesiones en el Puente Nuevo y el Tajo",
    seo_description_es:
      "Reserva un fotógrafo profesional en Ronda. Sesiones de pareja, pedida de mano y luna de miel en el Puente Nuevo, los miradores del Tajo y el casco antiguo.",
    name_de: "Ronda",
    description_de:
      "Eine Stadt, geteilt von einer 120 Meter tiefen Schlucht und verbunden durch eine Steinbrücke — Spaniens dramatischste Kulisse.",
    name_fr: "Ronda",
    description_fr:
      "Une ville coupée par des gorges de 120 mètres et reliée par un pont de pierre — le décor le plus spectaculaire d'Espagne.",
  },
  {
    id: "cordoba",
    slug: "cordoba",
    name: "Córdoba",
    region: "Andalusia",
    description:
      "A forest of red-and-white arches inside the Mezquita, and courtyards buried under flowerpots.",
    long_description:
      "Córdoba's Mezquita is one of the few interiors in Spain worth building an entire session around: hundreds of double arches in red brick and pale stone, repeating in every direction. Outside it, the Jewish Quarter is a grid of narrow whitewashed lanes, and the city's famous patios — courtyards covered wall to wall in geraniums — open to visitors in May. The Roman bridge over the Guadalquivir gives the wide establishing shot, especially at dusk with the Mezquita lit behind. Summers are genuinely hot, so shoots run early or late.",
    cover_image: "/images/locations/cordoba-cover.jpg",
    gallery_images: [],
    lat: 37.8882,
    lng: -4.7794,
    photographer_count: 0,
    seo_title: "Photographer in Córdoba — Mezquita & Patios Photoshoots",
    seo_description:
      "Book a professional photographer in Córdoba. Couple, family and solo photoshoots at the Mezquita, the Jewish Quarter, the patios and the Roman bridge.",
    name_es: "Córdoba",
    description_es:
      "Un bosque de arcos rojos y blancos dentro de la Mezquita, y patios enterrados bajo macetas.",
    long_description_es:
      "La Mezquita de Córdoba es uno de los pocos interiores de España que sostienen una sesión entera: cientos de arcos dobles de ladrillo rojo y piedra clara repitiéndose en todas direcciones. Fuera, la Judería es una retícula de callejones encalados, y los famosos patios cordobeses —cubiertos de geranios de pared a pared— abren al público en mayo. El puente romano sobre el Guadalquivir aporta el plano general, sobre todo al anochecer con la Mezquita iluminada al fondo. Los veranos aprietan de verdad, así que se fotografía temprano o tarde.",
    seo_title_es: "Fotógrafo en Córdoba — Sesiones en la Mezquita y los patios",
    seo_description_es:
      "Reserva un fotógrafo profesional en Córdoba. Sesiones de pareja, familia y solo en la Mezquita, la Judería, los patios y el puente romano.",
    name_de: "Córdoba",
    description_de:
      "Ein Wald rot-weißer Bögen in der Mezquita und Innenhöfe unter Bergen von Blumentöpfen.",
    name_fr: "Cordoue",
    description_fr:
      "Une forêt d'arcs rouges et blancs dans la Mezquita et des patios croulant sous les pots de fleurs.",
  },
  {
    id: "cadiz",
    slug: "cadiz",
    name: "Cádiz",
    region: "Andalusia",
    description:
      "The oldest city in Western Europe, almost surrounded by Atlantic water, with sunsets straight down its beaches.",
    long_description:
      "Cádiz sits on a spit of land with the Atlantic on three sides, which means light from every direction and a horizon at the end of most streets. La Caleta beach, framed by two old forts, is where the city watches the sun go down. The old town is a dense grid of tall, pale houses and watchtowers, with small squares full of laurel trees. It is less visited by international travellers than Seville or Granada, which shows in the photographs — fewer crowds in frame, and a working coastal city rather than a monument.",
    cover_image: "/images/locations/cadiz-cover.jpg",
    gallery_images: [],
    lat: 36.5271,
    lng: -6.2886,
    photographer_count: 0,
    seo_title: "Photographer in Cádiz — Atlantic Coast Photoshoots",
    seo_description:
      "Book a professional photographer in Cádiz. Couple, family and solo photoshoots at La Caleta, the old town and the Atlantic beaches.",
    name_es: "Cádiz",
    description_es:
      "La ciudad más antigua de Europa occidental, casi rodeada por el Atlántico, con puestas de sol al final de cada playa.",
    long_description_es:
      "Cádiz se asienta en una lengua de tierra con el Atlántico por tres lados, lo que significa luz desde cualquier dirección y horizonte al final de casi todas las calles. La playa de La Caleta, enmarcada por dos castillos, es donde la ciudad mira caer el sol. El casco antiguo es una trama densa de casas altas y claras con torres miradores y plazas pequeñas llenas de laureles. Recibe menos visitantes internacionales que Sevilla o Granada, y eso se nota en las fotos: menos gente en el encuadre y una ciudad marinera viva, no un monumento.",
    seo_title_es: "Fotógrafo en Cádiz — Sesiones en la costa atlántica",
    seo_description_es:
      "Reserva un fotógrafo profesional en Cádiz. Sesiones de pareja, familia y solo en La Caleta, el casco antiguo y las playas atlánticas.",
    name_de: "Cádiz",
    description_de:
      "Die älteste Stadt Westeuropas, fast vom Atlantik umschlossen, mit Sonnenuntergängen am Ende jeder Straße.",
    name_fr: "Cadix",
    description_fr:
      "La plus ancienne ville d'Europe occidentale, presque encerclée par l'Atlantique, avec des couchers de soleil au bout des rues.",
  },

  // ────────────────────── Balearic Islands ──────────────────────
  {
    id: "mallorca",
    slug: "mallorca",
    name: "Mallorca",
    region: "Balearic Islands",
    description:
      "A cathedral on the water in Palma, a mountain range along the north coast, and coves between the two.",
    long_description:
      "Mallorca covers more ground than visitors expect. Palma gives a sandstone cathedral standing directly above a seafront pool of water, plus an old town of courtyards and shuttered façades. North and west, the Serra de Tramuntana runs the length of the coast in terraced olive groves and stone villages — Deià, Valldemossa, Sóller — with viewpoints over cliffs that drop straight into the sea. Between them are the calas: small turquoise coves reached down pine-covered paths. It is the strongest wedding and honeymoon island in Spain, with German and British clients dominating.",
    cover_image: "/images/locations/mallorca-cover.jpg",
    gallery_images: [],
    lat: 39.5696,
    lng: 2.6502,
    photographer_count: 0,
    seo_title: "Photographer in Mallorca — Island & Coastal Photoshoots",
    seo_description:
      "Book a professional photographer in Mallorca. Couple, honeymoon and family photoshoots in Palma, the Serra de Tramuntana, Deià and the coves.",
    name_es: "Mallorca",
    description_es:
      "Una catedral sobre el agua en Palma, una sierra a lo largo de la costa norte y calas entre medias.",
    long_description_es:
      "Mallorca da mucho más de sí de lo que la gente espera. Palma aporta una catedral de arenisca alzada justo sobre un estanque frente al mar, y un casco antiguo de patios y fachadas con persianas. Al norte y al oeste, la Serra de Tramuntana recorre toda la costa entre olivares aterrazados y pueblos de piedra —Deià, Valldemossa, Sóller— con miradores sobre acantilados que caen a plomo. Entre unos y otros están las calas: pequeñas ensenadas turquesa a las que se baja por senderos de pinos. Es la isla más fuerte de España en bodas y lunas de miel, con clientela sobre todo alemana y británica.",
    seo_title_es: "Fotógrafo en Mallorca — Sesiones en la isla y la costa",
    seo_description_es:
      "Reserva un fotógrafo profesional en Mallorca. Sesiones de pareja, luna de miel y familia en Palma, la Serra de Tramuntana, Deià y las calas.",
    name_de: "Mallorca",
    description_de:
      "Eine Kathedrale am Wasser in Palma, ein Gebirge entlang der Nordküste und Buchten dazwischen.",
    name_fr: "Majorque",
    description_fr:
      "Une cathédrale au bord de l'eau à Palma, une chaîne de montagnes le long de la côte nord et des criques entre les deux.",
  },
  {
    id: "ibiza",
    slug: "ibiza",
    name: "Ibiza",
    region: "Balearic Islands",
    description:
      "The walled old town above the harbour, white villages inland, and the sunset the island is named for.",
    long_description:
      "Ibiza has a quieter photographic identity than its reputation suggests. Dalt Vila, the fortified old town, climbs above the port in sandstone ramparts and narrow stepped lanes, and the view from the top covers the whole harbour. Inland the island is white chapels, dry-stone walls and almond groves. The west coast — Cala Comte, Cala Bassa, Es Vedrà on the horizon — produces the sunsets people travel for, and most couple sessions are scheduled for the last hour of light there. Peak season is busy; May, June and September photograph better.",
    cover_image: "/images/locations/ibiza-cover.jpg",
    gallery_images: [],
    lat: 38.9067,
    lng: 1.4206,
    photographer_count: 0,
    seo_title: "Photographer in Ibiza — Sunset & Old Town Photoshoots",
    seo_description:
      "Book a professional photographer in Ibiza. Couple, honeymoon and family photoshoots at Dalt Vila, Cala Comte and the west-coast sunsets.",
    name_es: "Ibiza",
    description_es:
      "El casco antiguo amurallado sobre el puerto, pueblos blancos en el interior y el atardecer que dio fama a la isla.",
    long_description_es:
      "Ibiza tiene una identidad fotográfica más serena de lo que sugiere su fama. Dalt Vila, el recinto amurallado, trepa sobre el puerto entre murallas de arenisca y callejones escalonados, y desde arriba se domina toda la bahía. El interior es de ermitas blancas, muros de piedra seca y almendros. La costa oeste —Cala Comte, Cala Bassa, Es Vedrà en el horizonte— produce los atardeceres por los que se viaja, y allí se programan casi todas las sesiones de pareja, en la última hora de luz. En temporada alta hay mucha gente; mayo, junio y septiembre fotografían mejor.",
    seo_title_es: "Fotógrafo en Ibiza — Sesiones al atardecer y en Dalt Vila",
    seo_description_es:
      "Reserva un fotógrafo profesional en Ibiza. Sesiones de pareja, luna de miel y familia en Dalt Vila, Cala Comte y los atardeceres de la costa oeste.",
    name_de: "Ibiza",
    description_de:
      "Die ummauerte Altstadt über dem Hafen, weiße Dörfer im Inselinneren und der Sonnenuntergang, für den die Insel bekannt ist.",
    name_fr: "Ibiza",
    description_fr:
      "La vieille ville fortifiée au-dessus du port, des villages blancs à l'intérieur et le coucher de soleil qui a fait la réputation de l'île.",
  },
  {
    id: "menorca",
    slug: "menorca",
    name: "Menorca",
    region: "Balearic Islands",
    description:
      "The quiet Balearic: a coastal path around the whole island, empty coves and a harbour town in Georgian colours.",
    long_description:
      "Menorca is the island people choose when they want the Balearics without the crowds. The Camí de Cavalls, a bridleway that circles the entire coast, opens onto coves that are often empty even in August — Cala Macarella and Cala Pregonda among them. Ciutadella has a small sandstone old town around a narrow port; Mahón sits above one of the largest natural harbours in the Mediterranean, in pale Georgian-influenced façades left by the British. The whole island is a UNESCO biosphere reserve, which is why it still looks like this.",
    cover_image: "/images/locations/menorca-cover.jpg",
    gallery_images: [],
    lat: 39.8885,
    lng: 4.2658,
    photographer_count: 0,
    seo_title: "Photographer in Menorca — Coves & Coastal Photoshoots",
    seo_description:
      "Book a professional photographer in Menorca. Couple, honeymoon and family photoshoots at Cala Macarella, Ciutadella and the Camí de Cavalls.",
    name_es: "Menorca",
    description_es:
      "La balear tranquila: un camino de costa que rodea la isla entera, calas vacías y un puerto de fachadas georgianas.",
    long_description_es:
      "Menorca es la isla que se elige cuando se quieren las Baleares sin la multitud. El Camí de Cavalls, la senda que rodea todo el litoral, da acceso a calas que siguen vacías incluso en agosto, como Cala Macarella o Cala Pregonda. Ciutadella tiene un pequeño casco antiguo de arenisca alrededor de un puerto estrecho; Mahón se asienta sobre uno de los puertos naturales más grandes del Mediterráneo, entre fachadas claras de influencia georgiana que dejaron los británicos. Toda la isla es reserva de la biosfera, y por eso sigue teniendo este aspecto.",
    seo_title_es: "Fotógrafo en Menorca — Sesiones en calas y costa",
    seo_description_es:
      "Reserva un fotógrafo profesional en Menorca. Sesiones de pareja, luna de miel y familia en Cala Macarella, Ciutadella y el Camí de Cavalls.",
    name_de: "Menorca",
    description_de:
      "Die ruhige Baleareninsel: ein Küstenpfad rund um die Insel, leere Buchten und ein Hafenstädtchen in georgianischen Farben.",
    name_fr: "Minorque",
    description_fr:
      "La Baléare tranquille : un sentier côtier faisant le tour de l'île, des criques désertes et un port aux façades georgiennes.",
  },

  // ────────────────────── Canary Islands ──────────────────────
  {
    id: "tenerife",
    slug: "tenerife",
    name: "Tenerife",
    region: "Canary Islands",
    description:
      "Spain's highest peak above a sea of cloud, laurel forest in the north and black volcanic beaches.",
    long_description:
      "Tenerife offers landscapes that exist nowhere else in Spain. Teide National Park sits above 2,000 metres in red and ochre volcanic desert, frequently above a solid layer of cloud — a backdrop unlike anything on the mainland, and the reason many couples come here specifically. The Anaga massif in the north is ancient laurel forest, wet and green. The coasts run from black sand at Playa Jardín to the cliffs of Los Gigantes. Year-round mild weather makes it the most reliable winter destination in the country for outdoor sessions.",
    cover_image: "/images/locations/tenerife-cover.jpg",
    gallery_images: [],
    lat: 28.4636,
    lng: -16.2518,
    photographer_count: 0,
    seo_title: "Photographer in Tenerife — Teide & Coastal Photoshoots",
    seo_description:
      "Book a professional photographer in Tenerife. Couple, honeymoon and family photoshoots at Teide National Park, Anaga and the volcanic beaches.",
    name_es: "Tenerife",
    description_es:
      "El pico más alto de España sobre un mar de nubes, laurisilva en el norte y playas de arena negra.",
    long_description_es:
      "Tenerife ofrece paisajes que no existen en ningún otro punto de España. El Parque Nacional del Teide se extiende por encima de los 2.000 metros en un desierto volcánico rojo y ocre, a menudo sobre una capa compacta de nubes: un fondo sin equivalente en la península y el motivo por el que muchas parejas vienen expresamente. El macizo de Anaga, al norte, es laurisilva antigua, húmeda y verde. Las costas van de la arena negra de Playa Jardín a los acantilados de Los Gigantes. El clima suave todo el año la convierte en el destino invernal más fiable del país para sesiones al aire libre.",
    seo_title_es: "Fotógrafo en Tenerife — Sesiones en el Teide y la costa",
    seo_description_es:
      "Reserva un fotógrafo profesional en Tenerife. Sesiones de pareja, luna de miel y familia en el Parque Nacional del Teide, Anaga y las playas volcánicas.",
    name_de: "Teneriffa",
    description_de:
      "Spaniens höchster Gipfel über einem Wolkenmeer, Lorbeerwald im Norden und schwarze Vulkanstrände.",
    name_fr: "Tenerife",
    description_fr:
      "Le plus haut sommet d'Espagne au-dessus d'une mer de nuages, forêt de lauriers au nord et plages volcaniques noires.",
  },
  {
    id: "gran-canaria",
    slug: "gran-canaria",
    name: "Gran Canaria",
    region: "Canary Islands",
    description:
      "A desert of dunes running into the Atlantic in the south, and a green mountain interior an hour away.",
    long_description:
      "Gran Canaria is often described as a continent in miniature, and for a photographer that is close to literal. The Maspalomas dunes in the south are a genuine desert — ridges of pale sand meeting the ocean, best in the first and last hour of light, and one of the most striking backdrops in the country. Drive inland and within an hour you are among pine forest, ravines and the rock monolith of Roque Nublo. Las Palmas on the north coast adds a colonial old town and a long city beach. Warm all year.",
    cover_image: "/images/locations/gran-canaria-cover.jpg",
    gallery_images: [],
    lat: 28.1235,
    lng: -15.4363,
    photographer_count: 0,
    seo_title: "Photographer in Gran Canaria — Dunes & Island Photoshoots",
    seo_description:
      "Book a professional photographer in Gran Canaria. Couple, honeymoon and family photoshoots at the Maspalomas dunes, Roque Nublo and Las Palmas.",
    name_es: "Gran Canaria",
    description_es:
      "Un desierto de dunas que muere en el Atlántico al sur, y un interior verde de montaña a una hora de allí.",
    long_description_es:
      "A Gran Canaria se la llama continente en miniatura, y para un fotógrafo eso es casi literal. Las dunas de Maspalomas, al sur, son un desierto de verdad: crestas de arena clara que llegan hasta el océano, mejores en la primera y la última hora de luz, y uno de los fondos más impactantes del país. Tirando hacia el interior, en una hora se está entre pinares, barrancos y el monolito del Roque Nublo. Las Palmas, en la costa norte, suma un casco colonial y una playa urbana larguísima. Cálida todo el año.",
    seo_title_es: "Fotógrafo en Gran Canaria — Sesiones en las dunas y la isla",
    seo_description_es:
      "Reserva un fotógrafo profesional en Gran Canaria. Sesiones de pareja, luna de miel y familia en las dunas de Maspalomas, el Roque Nublo y Las Palmas.",
    name_de: "Gran Canaria",
    description_de:
      "Eine Dünenwüste, die im Süden in den Atlantik läuft, und ein grünes Bergland eine Stunde entfernt.",
    name_fr: "Grande Canarie",
    description_fr:
      "Un désert de dunes plongeant dans l'Atlantique au sud, et un intérieur montagneux et vert à une heure de là.",
  },
  {
    id: "lanzarote",
    slug: "lanzarote",
    name: "Lanzarote",
    region: "Canary Islands",
    description:
      "Black lava fields, white cubic houses and green vineyards grown in volcanic pits — the most graphic island in Spain.",
    long_description:
      "Lanzarote looks designed, and to a degree it was: the artist César Manrique shaped the island's building rules, which is why every house is white with green or blue woodwork against black volcanic ground. The contrast is extreme and photographs with almost no processing. Timanfaya's lava fields give an alien, empty landscape; La Geria's vineyards sit in thousands of black stone crescents; the north has cliffs and the Mirador del Río. Fewer trees and softer crowds than the bigger islands, and consistent light most of the year.",
    cover_image: "/images/locations/lanzarote-cover.jpg",
    gallery_images: [],
    lat: 28.9637,
    lng: -13.5477,
    photographer_count: 0,
    seo_title: "Photographer in Lanzarote — Volcanic Landscape Photoshoots",
    seo_description:
      "Book a professional photographer in Lanzarote. Couple, honeymoon and family photoshoots at Timanfaya, La Geria and the northern cliffs.",
    name_es: "Lanzarote",
    description_es:
      "Coladas negras, casas blancas cúbicas y viñedos verdes en hoyos volcánicos: la isla más gráfica de España.",
    long_description_es:
      "Lanzarote parece diseñada, y en parte lo está: el artista César Manrique fijó las reglas constructivas de la isla, y por eso cada casa es blanca con carpintería verde o azul sobre un suelo volcánico negro. El contraste es extremo y se fotografía casi sin procesado. Las coladas de Timanfaya dan un paisaje vacío, casi extraterrestre; los viñedos de La Geria se asientan en miles de hoyos de piedra negra; el norte aporta acantilados y el Mirador del Río. Menos árboles y menos gentío que en las islas grandes, y luz constante buena parte del año.",
    seo_title_es: "Fotógrafo en Lanzarote — Sesiones en paisaje volcánico",
    seo_description_es:
      "Reserva un fotógrafo profesional en Lanzarote. Sesiones de pareja, luna de miel y familia en Timanfaya, La Geria y los acantilados del norte.",
    name_de: "Lanzarote",
    description_de:
      "Schwarze Lavafelder, weiße Würfelhäuser und grüne Weinstöcke in Vulkangruben — die grafischste Insel Spaniens.",
    name_fr: "Lanzarote",
    description_fr:
      "Champs de lave noire, maisons blanches cubiques et vignes vertes en creux volcaniques — l'île la plus graphique d'Espagne.",
  },

  // ────────────────────── Valencian Community ──────────────────────
  {
    id: "valencia",
    slug: "valencia",
    name: "Valencia",
    region: "Valencian Community",
    description:
      "Futuristic white architecture, a riverbed turned into a nine-kilometre park, and a wide city beach.",
    long_description:
      "Valencia's advantage is contrast within walking distance. The City of Arts and Sciences is a set of white sculptural buildings surrounded by shallow reflecting pools — clean, modern, and unlike anything else in Spain. The old town is the opposite: the Silk Exchange, the cathedral, the Barrio del Carmen's narrow streets and painted walls. Between them the Turia gardens run for nine kilometres along a diverted riverbed, full of orange trees and palms. Malvarrosa beach closes the day. Warm from April to October and noticeably less crowded than Barcelona.",
    cover_image: "/images/locations/valencia-cover.jpg",
    gallery_images: [],
    lat: 39.4699,
    lng: -0.3763,
    photographer_count: 0,
    seo_title: "Photographer in Valencia — City & Beach Photoshoots",
    seo_description:
      "Book a professional photographer in Valencia. Couple, family and solo photoshoots at the City of Arts and Sciences, the old town, Turia gardens and Malvarrosa beach.",
    name_es: "Valencia",
    description_es:
      "Arquitectura blanca futurista, un cauce convertido en nueve kilómetros de parque y una playa urbana enorme.",
    long_description_es:
      "La ventaja de Valencia es el contraste a distancia de paseo. La Ciudad de las Artes y las Ciencias es un conjunto de edificios blancos escultóricos rodeados de láminas de agua: limpio, moderno y sin equivalente en España. El casco antiguo es lo contrario: la Lonja de la Seda, la catedral, las calles estrechas y los muros pintados del Barrio del Carmen. Entre ambos, los jardines del Turia recorren nueve kilómetros por el cauce desviado del río, llenos de naranjos y palmeras. La Malvarrosa cierra el día. Cálida de abril a octubre y bastante menos saturada que Barcelona.",
    seo_title_es: "Fotógrafo en Valencia — Sesiones en la ciudad y la playa",
    seo_description_es:
      "Reserva un fotógrafo profesional en Valencia. Sesiones de pareja, familia y solo en la Ciudad de las Artes y las Ciencias, el casco antiguo, el Turia y la Malvarrosa.",
    name_de: "Valencia",
    description_de:
      "Futuristische weiße Architektur, ein zum Park umgebautes Flussbett und ein breiter Stadtstrand.",
    name_fr: "Valence",
    description_fr:
      "Architecture blanche futuriste, un lit de rivière transformé en parc de neuf kilomètres et une large plage urbaine.",
  },

  // ────────────────────── Basque Country ──────────────────────
  {
    id: "san-sebastian",
    slug: "san-sebastian",
    name: "San Sebastián",
    region: "Basque Country",
    description:
      "A shell-shaped bay between two green hills, with Belle Époque railings and the best food in Spain.",
    long_description:
      "La Concha is one of the most recognisable urban beaches in Europe: a near-perfect crescent closed by an island, framed by white ironwork railings and street lamps that photograph beautifully at blue hour. Monte Igueldo at the western end gives the postcard view over the whole bay; Monte Urgull holds the other side. The old town behind the beach is dense, stone-built and full of pintxos bars. The Basque coast is greener and cooler than the south, with dramatic Atlantic weather that often works in a photograph's favour.",
    cover_image: "/images/locations/san-sebastian-cover.jpg",
    gallery_images: [],
    lat: 43.3183,
    lng: -1.9812,
    photographer_count: 0,
    seo_title: "Photographer in San Sebastián — La Concha & Old Town Photoshoots",
    seo_description:
      "Book a professional photographer in San Sebastián. Couple, family and solo photoshoots at La Concha beach, Monte Igueldo and the old town.",
    name_es: "San Sebastián",
    description_es:
      "Una bahía en forma de concha entre dos montes verdes, con barandillas de la Belle Époque y la mejor mesa de España.",
    long_description_es:
      "La Concha es una de las playas urbanas más reconocibles de Europa: una media luna casi perfecta cerrada por una isla, enmarcada por la barandilla blanca y las farolas que tan bien fotografían a la hora azul. El Monte Igueldo, en el extremo oeste, da la vista de postal sobre toda la bahía; el Urgull cierra el otro lado. La Parte Vieja, detrás de la playa, es densa, de piedra y llena de barras de pintxos. La costa vasca es más verde y fresca que el sur, con un tiempo atlántico cambiante que a menudo juega a favor de la foto.",
    seo_title_es: "Fotógrafo en San Sebastián — Sesiones en La Concha y la Parte Vieja",
    seo_description_es:
      "Reserva un fotógrafo profesional en San Sebastián. Sesiones de pareja, familia y solo en la playa de La Concha, el Monte Igueldo y la Parte Vieja.",
    name_de: "San Sebastián",
    description_de:
      "Eine muschelförmige Bucht zwischen zwei grünen Hügeln, mit Belle-Époque-Geländern und der besten Küche Spaniens.",
    name_fr: "Saint-Sébastien",
    description_fr:
      "Une baie en forme de coquille entre deux collines vertes, avec ses garde-corps Belle Époque et la meilleure table d'Espagne.",
  },
  {
    id: "bilbao",
    slug: "bilbao",
    name: "Bilbao",
    region: "Basque Country",
    description:
      "Titanium curves on the riverbank, a restored medieval core and green hills closing every view.",
    long_description:
      "Bilbao is a city that rebuilt itself around a museum. The Guggenheim's titanium shell changes colour with the weather and gives an instantly recognisable backdrop, with Puppy, the Maman spider and the river walkways around it. Upriver, the Casco Viejo is seven medieval streets of tall façades and covered markets. The hills come right down to the edge of the city, so nearly every wide shot has green behind it. Rain is frequent and, on the reflective riverside surfaces, often an advantage rather than a problem.",
    cover_image: "/images/locations/bilbao-cover.jpg",
    gallery_images: [],
    lat: 43.263,
    lng: -2.935,
    photographer_count: 0,
    seo_title: "Photographer in Bilbao — Guggenheim & Old Town Photoshoots",
    seo_description:
      "Book a professional photographer in Bilbao. Couple, family and solo photoshoots at the Guggenheim, the riverside and the Casco Viejo.",
    name_es: "Bilbao",
    description_es:
      "Curvas de titanio a la orilla de la ría, un casco medieval restaurado y montes verdes cerrando cada vista.",
    long_description_es:
      "Bilbao es una ciudad que se reconstruyó alrededor de un museo. La piel de titanio del Guggenheim cambia de color con el tiempo y ofrece un fondo reconocible al instante, con Puppy, la araña Maman y los paseos de la ría alrededor. Río arriba, el Casco Viejo son siete calles medievales de fachadas altas y mercados cubiertos. Los montes bajan hasta el borde de la ciudad, así que casi todo plano general lleva verde detrás. Llueve a menudo y, sobre las superficies reflectantes de la ría, eso suele ser una ventaja más que un problema.",
    seo_title_es: "Fotógrafo en Bilbao — Sesiones en el Guggenheim y el Casco Viejo",
    seo_description_es:
      "Reserva un fotógrafo profesional en Bilbao. Sesiones de pareja, familia y solo en el Guggenheim, la ría y el Casco Viejo.",
    name_de: "Bilbao",
    description_de:
      "Titankurven am Flussufer, ein restaurierter mittelalterlicher Kern und grüne Hügel als Abschluss jeder Aussicht.",
    name_fr: "Bilbao",
    description_fr:
      "Courbes de titane au bord du fleuve, cœur médiéval restauré et collines vertes fermant chaque perspective.",
  },

  // ───────────────────────── Galicia ─────────────────────────
  {
    id: "santiago-de-compostela",
    slug: "santiago-de-compostela",
    name: "Santiago de Compostela",
    region: "Galicia",
    description:
      "The end of the Camino: a granite cathedral over a vast square, arcaded streets and frequent Atlantic mist.",
    long_description:
      "Santiago is where the Camino ends, and the emotional weight of that shows in the photographs taken here. The cathedral's baroque façade rises over the Praza do Obradoiro, an enormous empty square that gives a sense of scale few places can. The old town around it is granite, arcaded and often wet, which makes the stone shine. Pilgrims arriving at all hours give candid material that no other Spanish city offers. Galicia is green, cool and rainy — a completely different palette from the Mediterranean coast, and worth having in the catalogue for exactly that reason.",
    cover_image: "/images/locations/santiago-de-compostela-cover.jpg",
    gallery_images: [],
    lat: 42.8805,
    lng: -8.5457,
    photographer_count: 0,
    seo_title: "Photographer in Santiago de Compostela — Cathedral & Camino Photoshoots",
    seo_description:
      "Book a professional photographer in Santiago de Compostela. Couple, family, solo and Camino arrival photoshoots at the cathedral and the old town.",
    name_es: "Santiago de Compostela",
    description_es:
      "El final del Camino: una catedral de granito sobre una plaza inmensa, calles con soportales y niebla atlántica.",
    long_description_es:
      "Santiago es donde termina el Camino, y esa carga emocional se nota en las fotos que se hacen aquí. La fachada barroca de la catedral se alza sobre la Praza do Obradoiro, una explanada enorme que da una sensación de escala difícil de encontrar. El casco antiguo es de granito, con soportales y a menudo mojado, lo que hace brillar la piedra. Los peregrinos que llegan a todas horas ofrecen un material espontáneo que ninguna otra ciudad española tiene. Galicia es verde, fresca y lluviosa: una paleta completamente distinta a la del Mediterráneo, y por eso merece estar en el catálogo.",
    seo_title_es: "Fotógrafo en Santiago de Compostela — Sesiones en la catedral y el Camino",
    seo_description_es:
      "Reserva un fotógrafo profesional en Santiago de Compostela. Sesiones de pareja, familia, solo y de llegada del Camino en la catedral y el casco antiguo.",
    name_de: "Santiago de Compostela",
    description_de:
      "Das Ende des Jakobswegs: eine Granitkathedrale über einem riesigen Platz, Arkadengassen und häufiger Atlantiknebel.",
    name_fr: "Saint-Jacques-de-Compostelle",
    description_fr:
      "La fin du Camino : une cathédrale de granit sur une immense place, des rues à arcades et la brume atlantique.",
  },
];

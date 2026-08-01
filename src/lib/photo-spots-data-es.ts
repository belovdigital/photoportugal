import type { PhotoSpot } from "./photo-spots-data";

/**
 * Curated photo spots for the Spanish market.
 *
 * Hand-written, one entry at a time. These cannot be generated: each spot names
 * a real place and says where to stand, when the light works and what goes
 * wrong there. Running the Portuguese list through place-name substitution
 * produced "Benagil cave in the Costa del Sol" — a cave that does not exist —
 * which is why Spain shipped with no spot pages at all rather than invented ones.
 *
 * City keys MUST match slugs in `locations-data-es.ts`, otherwise the pages are
 * unreachable and the sitemap points at 404s.
 *
 * EN is the base; ES is written in full because Spanish photographers and a
 * large share of the domestic audience read it. DE and FR fall back to EN at
 * the call site, the same way the Portuguese dataset behaves.
 */
export const photoSpotsES: Record<string, PhotoSpot[]> = {
  barcelona: [
    {
      name: "Park Güell — the mosaic terrace",
      description:
        "Gaudí's broken-tile bench curving around a terrace above the whole city, with the Sagrada Família and the Mediterranean behind it.",
      nameEs: "Park Güell — la terraza del mosaico",
      descriptionEs:
        "El banco de trencadís de Gaudí curvándose por una terraza sobre toda la ciudad, con la Sagrada Família y el Mediterráneo al fondo.",
      long_description:
        "The Nature Square is the shot everyone comes for: a serpentine bench clad in broken ceramic, blue and green and ochre, wrapping a terrace that looks straight down over Barcelona to the sea. It photographs best from the north-east corner, where the bench leads the eye out of frame and the city fills the gap.\n\nThe terrace is inside the paid Monumental Zone, and entry is timed. Book the first slot of the day — around 9:30 — and you get twenty minutes before the crowd thickens; by noon there are people on every metre of the bench and the only clean frames are tight ones.\n\nThe free part of the park, up the hill towards the Carmel bunkers, has pine shade and stone viaducts that work well for portraits when the terrace is full.",
      long_description_es:
        "La Plaza de la Naturaleza es la foto por la que todo el mundo viene: un banco serpenteante recubierto de trencadís azul, verde y ocre, rodeando una terraza que mira directamente sobre Barcelona hasta el mar. Funciona mejor desde la esquina noreste, donde el banco lleva la mirada fuera del encuadre y la ciudad ocupa el hueco.\n\nLa terraza está dentro de la Zona Monumental, que es de pago y con hora de entrada. Reserva el primer turno del día, sobre las 9:30, y tendrás unos veinte minutos antes de que se llene; a mediodía hay gente en cada metro del banco y solo quedan planos cerrados.\n\nLa parte libre del parque, subiendo hacia los búnkeres del Carmel, tiene sombra de pinos y viaductos de piedra que funcionan muy bien para retratos cuando la terraza está a tope.",
      best_time: "First entry slot of the day, or the last hour before closing",
      best_timeEs: "El primer turno de entrada del día, o la última hora antes del cierre",
      tips: "Timed ticket required for the terrace — book days ahead in summer. The stairs are steep; flat shoes for the walk up, change at the top.",
      tipsEs:
        "Hace falta entrada con hora para la terraza: resérvala con días de antelación en verano. Las escaleras son empinadas; sube con calzado cómodo y cámbiate arriba.",
      tags: ["couples", "engagement", "solo", "family"],
      coordinates: { lat: 41.4145, lng: 2.1527 },
      address: "Park Güell, Carrer d'Olot, Barcelona",
    },
    {
      name: "Bunkers del Carmel",
      description:
        "Concrete gun platforms on a hilltop with a 360° view over the whole city — the best sunset in Barcelona and it costs nothing.",
      nameEs: "Búnkeres del Carmel",
      descriptionEs:
        "Plataformas de hormigón en lo alto de un cerro con vista de 360° sobre toda la ciudad: el mejor atardecer de Barcelona, y gratis.",
      long_description:
        "Anti-aircraft positions from the Civil War, left as bare concrete slabs on top of Turó de la Rovira. From up here the city reads as a grid running down to the sea, with the Sagrada Família and Torre Glòries breaking the skyline and Montjuïc closing the right-hand side.\n\nGo for the hour before sunset. The low sun comes in from behind the hill and rims your subjects while the city below turns amber; fifteen minutes after the sun drops, the streetlights come on and you get a second, completely different frame.\n\nIt is popular with locals and there is no railing — the drop on the seaward side is real. Keep a metre of margin and do not put anyone on the edge for the shot.",
      long_description_es:
        "Posiciones antiaéreas de la Guerra Civil, que quedaron como losas de hormigón desnudo en lo alto del Turó de la Rovira. Desde aquí la ciudad se lee como una cuadrícula que baja hasta el mar, con la Sagrada Família y la Torre Glòries recortando el perfil y Montjuïc cerrando por la derecha.\n\nVe la hora antes del atardecer. El sol bajo entra por detrás del cerro y perfila a los protagonistas mientras la ciudad se vuelve ámbar; quince minutos después de que se ponga, se encienden las farolas y tienes un segundo encuadre completamente distinto.\n\nEs un sitio muy frecuentado por la gente de aquí y no hay barandilla: la caída del lado del mar es real. Deja un metro de margen y no pongas a nadie al borde por la foto.",
      best_time: "The hour before sunset, then fifteen minutes after",
      best_timeEs: "La hora antes del atardecer, y quince minutos después",
      tips: "No shade and no water up there — bring both in summer. The last stretch is a steep unpaved path.",
      tipsEs:
        "Arriba no hay sombra ni agua: lleva ambas cosas en verano. El último tramo es un sendero empinado sin asfaltar.",
      tags: ["couples", "proposal", "solo", "engagement"],
      coordinates: { lat: 41.4194, lng: 2.1631 },
      address: "Turó de la Rovira, Barcelona",
    },
    {
      name: "Gothic Quarter — Carrer del Bisbe",
      description:
        "A neo-Gothic bridge spanning a narrow stone lane, with light dropping in from above at midday.",
      nameEs: "Barrio Gótico — Carrer del Bisbe",
      descriptionEs:
        "Un puente neogótico cruzando un callejón de piedra estrecho, con la luz cayendo desde arriba al mediodía.",
      long_description:
        "The Pont del Bisbe is the single most photographed corner of the old town: a carved stone footbridge thrown between two buildings across a lane barely four metres wide. Shot from below and centred, it frames a subject cleanly with nothing modern in view.\n\nThis is one of the rare places that works at midday — the lane is deep enough that direct sun only reaches the bridge itself, leaving the street in even shade and putting a bright band across the stonework above.\n\nThe surrounding streets — Carrer del Paradís, Plaça Sant Felip Neri, the cathedral cloister with its geese — give another half hour of frames without moving more than two hundred metres.",
      long_description_es:
        "El Pont del Bisbe es el rincón más fotografiado del casco antiguo: una pasarela de piedra tallada lanzada entre dos edificios sobre un callejón de apenas cuatro metros. Disparado desde abajo y centrado, enmarca al protagonista sin que aparezca nada moderno.\n\nEs de los pocos sitios que funcionan al mediodía: el callejón es tan profundo que el sol directo solo llega al puente, dejando la calle en sombra uniforme y una banda de luz sobre la piedra de arriba.\n\nLas calles de alrededor —Carrer del Paradís, la plaza de Sant Felip Neri, el claustro de la catedral con sus ocas— dan otra media hora de encuadres sin alejarse doscientos metros.",
      best_time: "Midday for the light shaft, or before 9am for an empty lane",
      best_timeEs: "Mediodía por el haz de luz, o antes de las 9 para tener el callejón vacío",
      tips: "It is on every walking-tour route. Wait for a gap between groups rather than fighting them — one comes every few minutes.",
      tipsEs:
        "Está en la ruta de todos los tours a pie. Espera el hueco entre grupos en vez de pelear con ellos: pasa uno cada pocos minutos.",
      tags: ["couples", "solo", "engagement"],
      coordinates: { lat: 41.3833, lng: 2.1764 },
      address: "Carrer del Bisbe, Barri Gòtic, Barcelona",
    },
    {
      name: "Barceloneta beach and the boardwalk",
      description:
        "City beach with palm-lined promenade — sand, sea and skyline in one frame, five minutes from the old town.",
      nameEs: "La Barceloneta y el paseo marítimo",
      descriptionEs:
        "Playa urbana con paseo de palmeras: arena, mar y perfil de la ciudad en un mismo encuadre, a cinco minutos del casco antiguo.",
      long_description:
        "Barceloneta is where a Barcelona session usually ends: the old fishermen's quarter opening onto four kilometres of sand, with the W hotel's sail closing the view south and the Port Vell masts to the north.\n\nGolden hour here is a side light — the sun sets behind the city, not over the water — which is flattering for faces and puts a warm edge on everything without the harsh backlight you get on a west-facing coast. Sunrise is the opposite and worth the alarm: light straight off the sea and an empty beach.\n\nWalk one street inland for the other version of the neighbourhood: narrow lanes, laundry across balconies, small squares. Same session, completely different set of frames.",
      long_description_es:
        "La Barceloneta es donde suele terminar una sesión en Barcelona: el viejo barrio de pescadores abriéndose a cuatro kilómetros de arena, con la vela del hotel W cerrando la vista al sur y los mástiles del Port Vell al norte.\n\nLa hora dorada aquí es luz lateral —el sol se pone detrás de la ciudad, no sobre el agua—, favorecedora para los rostros y con un borde cálido en todo, sin el contraluz duro de una costa orientada al oeste. El amanecer es lo contrario y merece el madrugón: luz directa desde el mar y playa vacía.\n\nUna calle hacia dentro está la otra versión del barrio: callejones estrechos, ropa tendida en los balcones, plazas pequeñas. La misma sesión, un repertorio completamente distinto.",
      best_time: "Sunrise for an empty beach, or the last hour of light for side sun",
      best_timeEs: "Amanecer para la playa vacía, o la última hora de luz para el sol lateral",
      tips: "August afternoons are shoulder-to-shoulder. Shoot early, or walk fifteen minutes north to Bogatell where it thins out.",
      tipsEs:
        "Las tardes de agosto están a reventar. Dispara temprano, o camina quince minutos al norte hasta Bogatell, donde hay mucha menos gente.",
      tags: ["family", "couples", "solo"],
      coordinates: { lat: 41.3784, lng: 2.1925 },
      address: "Platja de la Barceloneta, Barcelona",
    },
  ],
  madrid: [
    {
      name: "Templo de Debod at sunset",
      description:
        "A 2,200-year-old Egyptian temple reflected in still water, with the whole western sky behind it — the proposal spot of the city.",
      nameEs: "Templo de Debod al atardecer",
      descriptionEs:
        "Un templo egipcio de 2.200 años reflejado en agua quieta, con todo el cielo de poniente detrás: el sitio de las pedidas de mano de la ciudad.",
      long_description:
        "Egypt gave the temple to Spain in 1968 and it was rebuilt stone by stone on a rise in the Parque del Oeste, where the ground drops away west towards the Casa de Campo. That drop is the whole point: there is nothing between the temple and the horizon, so the sunset fills the frame behind it.\n\nStand on the east side and shoot into the light with the reflecting pool in the foreground — the temple and its gateways double in the water. Arrive forty minutes early; the good positions along the pool fill up, and this is the single most popular sunset in Madrid.\n\nMost proposals here are timed to the minute for a reason: the usable window is about fifteen minutes and the light changes fast. Agree the signal with your client beforehand.",
      long_description_es:
        "Egipto regaló el templo a España en 1968 y se reconstruyó piedra a piedra sobre una loma del Parque del Oeste, donde el terreno cae hacia el oeste, hacia la Casa de Campo. Esa caída lo es todo: no hay nada entre el templo y el horizonte, así que la puesta de sol llena el encuadre por detrás.\n\nColócate en el lado este y dispara a contraluz con el estanque en primer término: el templo y sus puertas se duplican en el agua. Llega cuarenta minutos antes; los buenos sitios junto al estanque se ocupan, y este es el atardecer más concurrido de Madrid.\n\nAquí las pedidas se cronometran al minuto por algo: la ventana útil es de unos quince minutos y la luz cambia deprisa. Acuerda la señal con tus clientes antes de empezar.",
      best_time: "The twenty minutes either side of sunset",
      best_timeEs: "Los veinte minutos antes y después de la puesta de sol",
      tips: "Scout the pool position an hour ahead. In winter the sun sets behind the trees rather than clear horizon — check the angle for the date.",
      tipsEs:
        "Ve a marcar tu sitio junto al estanque una hora antes. En invierno el sol se pone tras los árboles y no sobre el horizonte limpio: comprueba el ángulo para esa fecha.",
      tags: ["proposal", "couples", "engagement", "solo"],
      coordinates: { lat: 40.4240, lng: -3.7178 },
      address: "Templo de Debod, Parque del Oeste, Madrid",
    },
    {
      name: "Retiro — the Crystal Palace",
      description:
        "A glass pavilion on a lake inside the city's big park, with light coming through the structure from every side.",
      nameEs: "El Retiro — el Palacio de Cristal",
      descriptionEs:
        "Un pabellón de cristal sobre un estanque dentro del gran parque de la ciudad, con la luz atravesando la estructura por todos lados.",
      long_description:
        "Built for an 1887 exhibition and never taken down, the Palacio de Cristal is a glass-and-iron shell on the edge of a small lake, backed by bald cypresses that go copper in November.\n\nInside, the light is extraordinary and free — a whole room of it, diffused through glass, with no direction to fight. It suits family sessions where you cannot control where people stand. Outside, shoot from across the lake so the building and its reflection both fit.\n\nThe rest of the Retiro carries the session: the rose garden in May, the boating lake with the colonnade behind it, and long avenues of trimmed hedge that work at any hour.",
      long_description_es:
        "Construido para una exposición de 1887 y nunca desmontado, el Palacio de Cristal es una carcasa de hierro y vidrio al borde de un pequeño estanque, con cipreses calvos detrás que se vuelven cobrizos en noviembre.\n\nDentro la luz es extraordinaria y gratuita: una sala entera de luz difusa a través del cristal, sin dirección contra la que pelear. Va muy bien para sesiones de familia, donde no controlas dónde se coloca cada uno. Fuera, dispara desde la otra orilla para que quepan el edificio y su reflejo.\n\nEl resto del Retiro sostiene la sesión: la rosaleda en mayo, el estanque de las barcas con la columnata detrás y avenidas largas de seto recortado que funcionan a cualquier hora.",
      best_time: "Morning for empty interiors, late afternoon for the lake",
      best_timeEs: "Por la mañana para el interior vacío, a última hora de la tarde para el estanque",
      tips: "Tripods and professional gear can draw a park-warden conversation. Hand-held keeps it simple.",
      tipsEs:
        "Los trípodes y el equipo aparatoso pueden acabar en conversación con un guarda del parque. A pulso te ahorras el trámite.",
      tags: ["family", "couples", "solo", "maternity"],
      coordinates: { lat: 40.4139, lng: -3.6827 },
      address: "Palacio de Cristal, Parque del Retiro, Madrid",
    },
    {
      name: "Plaza Mayor and the lanes of La Latina",
      description:
        "A closed arcaded square in warm ochre, and behind it the oldest streets in the city.",
      nameEs: "La Plaza Mayor y las calles de La Latina",
      descriptionEs:
        "Una plaza porticada cerrada en ocre cálido y, detrás, las calles más antiguas de la ciudad.",
      long_description:
        "Plaza Mayor is a rectangle of uniform ochre facades with arcades running the whole way round, which means shade on one side at any hour and a covered fallback if it rains.\n\nThe arcades themselves are the better frame: repeating arches, warm stone, and enough depth to blur the far end. Under them you can shoot at noon in July, which is not true of anywhere else in central Madrid.\n\nLeave by the Arco de Cuchilleros and you are in La Latina — Cava Baja, Plaza de la Paja, tiled bar fronts, narrow streets that fall away downhill. Sundays the Rastro market fills them; energetic for candid work, impossible for anything posed.",
      long_description_es:
        "La Plaza Mayor es un rectángulo de fachadas ocres uniformes con soportales que la recorren entera: sombra en algún lado a cualquier hora y refugio cubierto si llueve.\n\nLos propios soportales son el mejor encuadre: arcos repetidos, piedra cálida y profundidad suficiente para desenfocar el fondo. Debajo puedes disparar a mediodía en julio, cosa que no ocurre en ningún otro punto del centro.\n\nSal por el Arco de Cuchilleros y estás en La Latina: Cava Baja, la plaza de la Paja, fachadas de bares con azulejos, callejuelas que bajan. Los domingos el Rastro las llena; muy vivo para foto espontánea, imposible para nada posado.",
      best_time: "Early morning, or midday under the arcades",
      best_timeEs: "Primera hora de la mañana, o mediodía bajo los soportales",
      tips: "Avoid Sunday mornings unless you specifically want market crowds. Costumed street performers will ask for money if they appear in shot.",
      tipsEs:
        "Evita los domingos por la mañana salvo que quieras el bullicio del Rastro. Los artistas disfrazados pedirán dinero si salen en el encuadre.",
      tags: ["couples", "family", "solo"],
      coordinates: { lat: 40.4155, lng: -3.7074 },
      address: "Plaza Mayor, Madrid",
    },
  ],

  seville: [
    {
      name: "Plaza de España",
      description:
        "A brick semicircle half a kilometre round, with tiled alcoves, four bridges and a canal you can row on.",
      nameEs: "La Plaza de España",
      descriptionEs:
        "Un semicírculo de ladrillo de medio kilómetro, con hornacinas de azulejos, cuatro puentes y un canal por el que se puede remar.",
      long_description:
        "Built for the 1929 Ibero-American Exposition and far larger in person than in photographs. The curved facade runs 200 metres, a canal follows it, and four tiled bridges cross the water — each one a ready-made frame.\n\nTwo shots carry a session here. From the centre of the plaza, wide, with the towers at either end and the whole arc behind your subjects. Then close, on one of the bridges, using the painted ceramic balustrade as foreground.\n\nThe forty-eight alcoves along the wall, one per Spanish province, are each tiled with a map and a historical scene — a corridor of colour that photographs beautifully in the shade while the plaza itself is blinding.",
      long_description_es:
        "Construida para la Exposición Iberoamericana de 1929 y mucho más grande en persona que en las fotos. La fachada curva mide 200 metros, un canal la acompaña y cuatro puentes de azulejos cruzan el agua: cada uno es un encuadre listo.\n\nDos planos sostienen la sesión. Desde el centro de la plaza, abierto, con las torres a ambos lados y todo el arco detrás de los protagonistas. Después cerrado, sobre uno de los puentes, usando la balaustrada de cerámica pintada como primer término.\n\nLas cuarenta y ocho hornacinas del muro, una por provincia, están alicatadas con un mapa y una escena histórica: un pasillo de color que fotografía precioso en sombra mientras la plaza deslumbra.",
      best_time: "First light — by 10am in summer the brick is glaring and the plaza is full",
      best_timeEs: "Primera luz: a las 10 en verano el ladrillo deslumbra y la plaza está llena",
      tips: "Commercial shoots technically need a permit; a couple with a photographer is normally left alone. Rowing boats rent by the half hour and put you alone on the water.",
      tipsEs:
        "Las sesiones comerciales requieren permiso en teoría; a una pareja con fotógrafo no suelen decirle nada. Las barcas se alquilan por media hora y te dejan solo en el agua.",
      tags: ["couples", "engagement", "proposal", "family"],
      coordinates: { lat: 37.3772, lng: -5.9869 },
      address: "Plaza de España, Parque de María Luisa, Sevilla",
    },
    {
      name: "Barrio de Santa Cruz",
      description:
        "Whitewashed lanes barely wide enough for two people, hung with geraniums and closed by orange trees.",
      nameEs: "El Barrio de Santa Cruz",
      descriptionEs:
        "Callejones encalados por los que apenas pasan dos personas, con geranios colgando y naranjos cerrando el fondo.",
      long_description:
        "The old Jewish quarter, now a maze of lanes between the cathedral and the Alcázar. Walls are lime-white and throw soft light back onto faces; doorways are painted ochre and blue; almost every corner has a wrought-iron balcony with geraniums over it.\n\nCalle Agua and Callejón del Agua are the classic runs, and the Plaza de Doña Elvira and Plaza de los Venerables give you small orange-tree squares to open out into when the lanes get too tight.\n\nBecause the streets are narrow and white, this works in the middle of the day — the sun never reaches the ground, and the bounce is flattering. That makes it the natural pairing with an early Plaza de España start.",
      long_description_es:
        "La antigua judería, hoy un laberinto de callejones entre la catedral y el Alcázar. Los muros son de cal blanca y devuelven una luz suave a los rostros; las puertas están pintadas de ocre y azul; casi cada esquina tiene un balcón de forja con geranios.\n\nLa calle Agua y el callejón del Agua son los recorridos clásicos, y las plazas de Doña Elvira y de los Venerables ofrecen placitas con naranjos donde abrirse cuando el callejón se queda estrecho.\n\nComo las calles son angostas y blancas, esto funciona a plena mitad del día: el sol nunca llega al suelo y el rebote favorece. Por eso combina de forma natural con empezar temprano en la Plaza de España.",
      best_time: "Any hour — the lanes are in shade all day",
      best_timeEs: "A cualquier hora: los callejones están en sombra todo el día",
      tips: "It is genuinely a maze and residential. Keep voices down in the early morning and do not block doorways.",
      tipsEs:
        "Es un laberinto de verdad y está habitado. Baja la voz a primera hora y no bloquees los portales.",
      tags: ["couples", "solo", "engagement"],
      coordinates: { lat: 37.3856, lng: -5.9895 },
      address: "Barrio de Santa Cruz, Sevilla",
    },
    {
      name: "Metropol Parasol (Las Setas)",
      description:
        "A waffle of pale timber floating over a square, with a walkway across the top of it.",
      nameEs: "Metropol Parasol (Las Setas)",
      descriptionEs:
        "Un enrejado de madera clara flotando sobre una plaza, con una pasarela que lo recorre por arriba.",
      long_description:
        "The largest timber structure in the world, dropped into a square of nineteenth-century Seville. From below it is a ceiling of interlocking hexagons; from the walkway on top it is a curving path with the old town spread out around it.\n\nShoot below first — the underside gives geometric shade and a strong graphic ceiling above your subjects. Then buy the walkway ticket and go up for sunset, when the timber turns orange and the cathedral catches the last light.\n\nThis is the counterweight to a session that is otherwise all Moorish arches and whitewash: it makes the set feel like a city rather than a museum.",
      long_description_es:
        "La mayor estructura de madera del mundo, plantada en una plaza de la Sevilla decimonónica. Desde abajo es un techo de hexágonos entrelazados; desde la pasarela superior, un camino curvo con el casco antiguo alrededor.\n\nDispara primero abajo: el intradós da sombra geométrica y un techo gráfico potente sobre los protagonistas. Después saca la entrada de la pasarela y sube al atardecer, cuando la madera se vuelve naranja y la catedral recoge la última luz.\n\nEs el contrapeso de una sesión que si no sería toda arcos árabes y cal: hace que el conjunto parezca una ciudad y no un museo.",
      best_time: "Underside any time; walkway for the last hour of light",
      best_timeEs: "El intradós a cualquier hora; la pasarela, la última hora de luz",
      tips: "Walkway ticket is cheap and includes a drink. It gets busy exactly at sunset — go up twenty minutes early.",
      tipsEs:
        "La entrada a la pasarela es barata e incluye una consumición. Se llena justo al atardecer: sube veinte minutos antes.",
      tags: ["couples", "solo", "engagement"],
      coordinates: { lat: 37.3934, lng: -5.9925 },
      address: "Plaza de la Encarnación, Sevilla",
    },
  ],
};

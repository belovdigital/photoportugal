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

  granada: [
    {
      name: "Mirador de San Nicolás",
      description:
        "The Alhambra across the valley with the snow line of the Sierra Nevada behind it — the view the city is famous for.",
      nameEs: "Mirador de San Nicolás",
      descriptionEs:
        "La Alhambra al otro lado del valle con la Sierra Nevada nevada detrás: la vista por la que se conoce a Granada.",
      long_description:
        "A small terrace at the top of the Albaicín, and one of the rare places where the famous viewpoint and the correct viewpoint are the same one. The Alhambra faces roughly west toward it, so at the end of the day the light lands on the palace walls while you shoot from the shaded side — warm stone, long shadows, mountains behind.\n\nThe terrace is genuinely small. Before sunset it fills with visitors and buskers, and the low wall everyone leans on is the only clean foreground. Sunrise is the same view with nobody on it, and the Sierra Nevada is usually clearer before the day heats up.\n\nBetween November and May the mountains normally still carry snow, which is what turns that background from a brown ridge into the photograph people have in mind.",
      long_description_es:
        "Una pequeña explanada en lo alto del Albaicín, y uno de los pocos sitios donde el mirador famoso y el mirador correcto son el mismo. La Alhambra mira hacia el oeste, así que al final del día la luz cae sobre los muros del palacio mientras se fotografía desde el lado en sombra: piedra cálida, sombras largas y montañas al fondo.\n\nLa explanada es pequeña de verdad. Antes del atardecer se llena de visitantes y músicos, y el murete donde todos se apoyan es el único primer plano limpio. Al amanecer es la misma vista sin nadie, y la Sierra Nevada suele verse más limpia antes de que apriete el calor.\n\nEntre noviembre y mayo la sierra normalmente conserva nieve, que es lo que convierte ese fondo en la foto que la gente tiene en la cabeza.",
      best_time: "Sunrise for an empty terrace, or the hour before sunset if you accept the crowd",
      best_timeEs: "Al amanecer para tenerlo vacío, o la hora antes del atardecer si acepta la gente",
      tips: "Free, no ticket, open at any hour. The walk up through the Albaicín is steep cobblestone — flat shoes. If the crowd would ruin it, Mirador de San Miguel Alto is higher and far quieter, with the Alhambra smaller in frame.",
      tipsEs:
        "Gratis, sin entrada y abierto a cualquier hora. La subida por el Albaicín es de adoquín y empinada: calzado cómodo. Si la gente le estropea la foto, el Mirador de San Miguel Alto está más alto y mucho más tranquilo, con la Alhambra más pequeña en el encuadre.",
      tags: ["couples", "proposal", "engagement", "solo"],
      coordinates: { lat: 37.1809, lng: -3.5924 },
      address: "Mirador de San Nicolás, Albaicín, Granada",
    },
    {
      name: "The Albaicín lanes",
      description:
        "A hillside of whitewashed lanes and walled gardens whose high walls keep the light soft when everywhere else is blown out.",
      nameEs: "Las calles del Albaicín",
      descriptionEs:
        "Una ladera de callejuelas encaladas y cármenes cuyos muros altos mantienen la luz suave cuando todo lo demás está quemado.",
      long_description:
        "Granada's old Moorish quarter, and the answer to what a session does between eleven and five. The lanes are narrow and the walls are high and white, so direct sun rarely reaches the floor — you are working with soft bounced light for most of the day, which is the opposite of what the viewpoints offer.\n\nLook for the carmenes: walled houses with private gardens whose bougainvillea, jasmine and cypress spill over into the street. Placeta de San Miguel Bajo is a small square that stays shaded and has none of the mirador crowd.\n\nIt is a maze, and it is steep throughout. A photographer who knows it will route the session downhill.",
      long_description_es:
        "El antiguo barrio morisco de Granada, y la respuesta a qué hacer en una sesión entre las once y las cinco. Las calles son estrechas y los muros altos y blancos, así que el sol directo casi nunca llega al suelo: se trabaja con luz rebotada suave casi todo el día, justo lo contrario que en los miradores.\n\nBusque los cármenes: casas con jardín privado cuyas buganvillas, jazmines y cipreses se asoman por encima de la tapia. La Placeta de San Miguel Bajo es una plaza pequeña que se mantiene en sombra y no tiene nada de la aglomeración del mirador.\n\nEs un laberinto y sube constantemente. Un fotógrafo que lo conozca planteará el recorrido cuesta abajo.",
      best_time: "Late morning through mid-afternoon — the hours that do not work anywhere else",
      best_timeEs: "De media mañana a media tarde: las horas que no funcionan en ningún otro sitio",
      tips: "Steep cobblestone everywhere, no shade breaks on the climb. Say up front if anyone in the group has trouble with stairs. Carry water in summer.",
      tipsEs:
        "Adoquín empinado por todas partes y sin sombra en la subida. Avise si alguien del grupo lleva mal las escaleras. En verano, agua.",
      tags: ["couples", "family", "solo", "engagement"],
      coordinates: { lat: 37.1836, lng: -3.5936 },
      address: "Albaicín, Granada",
    },
    {
      name: "Sacromonte",
      description:
        "Whitewashed cave houses cut into the hillside above the Albaicín — the least photographed angle on the Alhambra.",
      nameEs: "Sacromonte",
      descriptionEs:
        "Casas cueva encaladas excavadas en la ladera sobre el Albaicín, y el ángulo menos fotografiado de la Alhambra.",
      long_description:
        "Past the Albaicín the hill turns into Sacromonte, where the houses are cut into the rock. It is the historic Roma quarter and the birthplace of the Granada flamenco style, and it looks like nowhere else in Spain: white cave facades, prickly pear, agave, and a view back across at the Alhambra from an angle almost nobody uses.\n\nQuieter and rougher than the Albaicín, with fewer people and more space to work. The light is open here rather than bounced — the hillside faces the valley, so it takes sun for most of the day and comes into its own late.\n\nPeople live here. Treat it as a neighbourhood rather than a set and it gives you the most distinctive frames in Granada.",
      long_description_es:
        "Pasado el Albaicín, la ladera se convierte en el Sacromonte, donde las casas están excavadas en la roca. Es el barrio gitano histórico y la cuna del flamenco granadino, y no se parece a ningún otro sitio de España: fachadas blancas de cueva, chumberas, pitas y una vista de la Alhambra desde un ángulo que casi nadie usa.\n\nMás tranquilo y más áspero que el Albaicín, con menos gente y más espacio para trabajar. Aquí la luz es abierta, no rebotada: la ladera mira al valle, recibe sol casi todo el día y se pone interesante al final de la tarde.\n\nAquí vive gente. Trátelo como un barrio y no como un decorado, y le dará los encuadres más distintos de Granada.",
      best_time: "Late afternoon, when the hillside takes warm light",
      best_timeEs: "A última hora de la tarde, cuando la ladera recibe luz cálida",
      tips: "Uphill from the Albaicín and exposed — no shade on the walk. Ask before photographing near occupied cave houses; several are private homes, not attractions.",
      tipsEs:
        "Se sube desde el Albaicín y está expuesto: sin sombra en el camino. Pregunte antes de fotografiar junto a cuevas habitadas; varias son viviendas particulares, no atracciones.",
      tags: ["couples", "solo", "content-creator"],
      coordinates: { lat: 37.1823, lng: -3.5852 },
      address: "Camino del Sacromonte, Granada",
    },
  ],
  mallorca: [
    {
      name: "Deià",
      description:
        "A village of honey-coloured stone stacked on a Tramuntana hillside, with the sea at the bottom of it.",
      nameEs: "Deià",
      descriptionEs:
        "Un pueblo de piedra dorada apilado en una ladera de la Tramuntana, con el mar al fondo.",
      long_description:
        "The most photogenic village on Mallorca and the reason most elopements end up in the Serra de Tramuntana. Stone houses in a warm ochre that holds evening colour long after white render has gone flat, terraces of olive and almond behind, and a drop down to Cala Deià below.\n\nThe lanes climbing to the church at the top are narrow and shaded for most of the day, which makes them workable when the open hillside is not. The cemetery terrace beside the church has the view down the valley to the water — the frame the village is known for.\n\nDeià is small and it knows what it is. Expect other people with cameras, especially in the shoulder months when the light is best.",
      long_description_es:
        "El pueblo más fotogénico de Mallorca y la razón por la que la mayoría de las bodas íntimas acaban en la Serra de Tramuntana. Casas de piedra de un ocre cálido que conserva el color del atardecer mucho después de que el revoco blanco se haya apagado, bancales de olivo y almendro detrás, y la bajada hasta la Cala Deià.\n\nLas callejuelas que suben a la iglesia son estrechas y están en sombra casi todo el día, así que funcionan cuando la ladera abierta no. La terraza del cementerio junto a la iglesia tiene la vista del valle hasta el agua: el encuadre por el que se conoce el pueblo.\n\nDeià es pequeño y sabe lo que es. Habrá más gente con cámaras, sobre todo en los meses de temporada media, que es cuando mejor está la luz.",
      best_time: "The last two hours of light, when the stone turns",
      best_timeEs: "Las dos últimas horas de luz, cuando la piedra cambia de color",
      tips: "Parking in the village is very limited and the road through the Tramuntana is slow — allow far more travel time than the distance suggests. Cala Deià is a twenty-minute walk down and a harder walk back up.",
      tipsEs:
        "El aparcamiento en el pueblo es muy limitado y la carretera de la Tramuntana es lenta: calcule mucho más tiempo de trayecto del que sugiere la distancia. A la Cala Deià se baja en veinte minutos y se sube en bastante más.",
      tags: ["couples", "elopement", "honeymoon", "wedding"],
      coordinates: { lat: 39.7486, lng: 2.6489 },
      address: "Deià, Serra de Tramuntana, Mallorca",
    },
    {
      name: "Cap de Formentor",
      description:
        "A road along a knife-edge ridge to a lighthouse, with drops to the sea on both sides — the most dramatic place on the island.",
      nameEs: "Cap de Formentor",
      descriptionEs:
        "Una carretera por una cresta afilada hasta un faro, con caídas al mar a ambos lados: el sitio más dramático de la isla.",
      long_description:
        "Mallorca's northern tip, where the Tramuntana runs out into the sea. The road out to the lighthouse follows a ridge with cliffs falling away on both sides, and the Mirador Es Colomer partway along gives you the view back down the coast that appears on every Mallorca poster.\n\nThe scale is the point. Two people on that ridge read as very small against the drop, which is exactly what an elopement portrait wants and exactly what a family session usually does not.\n\nIt is also the most exposed place on the island. The wind here is genuinely strong most days — fabric and hair will move whether you want them to or not, which is either the best thing about the location or the reason to choose another one.",
      long_description_es:
        "El extremo norte de Mallorca, donde la Tramuntana se acaba en el mar. La carretera hasta el faro recorre una cresta con acantilados a ambos lados, y el Mirador Es Colomer, a mitad de camino, da la vista de la costa que aparece en todos los carteles de la isla.\n\nLa escala es lo que importa. Dos personas en esa cresta se ven muy pequeñas contra la caída, que es justo lo que quiere un retrato de boda íntima y justo lo que no suele querer una sesión familiar.\n\nTambién es el punto más expuesto de la isla. El viento aquí es fuerte de verdad casi todos los días: la ropa y el pelo se van a mover, lo quiera o no, y eso es lo mejor del sitio o la razón para elegir otro.",
      best_time: "Sunrise for calm air, or late afternoon for warm light on the cliffs",
      best_timeEs: "Al amanecer si quiere aire en calma, o al final de la tarde por la luz cálida en los acantilados",
      tips: "An hour and a half from Deià on a slow single-lane road, and in peak season car access is restricted in favour of shuttle buses — check before building a day around it. No shade, no shelter, strong wind.",
      tipsEs:
        "A hora y media de Deià por una carretera lenta de un solo carril, y en temporada alta el acceso en coche se restringe a favor de las lanzaderas: compruébelo antes de montar el día alrededor. Sin sombra, sin refugio y con viento fuerte.",
      tags: ["couples", "elopement", "honeymoon"],
      coordinates: { lat: 39.9601, lng: 3.2131 },
      address: "Cap de Formentor, Pollença, Mallorca",
    },
    {
      name: "Port de Sóller and the valley",
      description:
        "A horseshoe harbour reached through citrus groves, joined to the town by a wooden tram that has run since 1913.",
      nameEs: "Port de Sóller y el valle",
      descriptionEs:
        "Un puerto en herradura al que se llega entre naranjos, unido al pueblo por un tranvía de madera que funciona desde 1913.",
      long_description:
        "The Sóller valley is a bowl of orange and lemon groves surrounded by mountains, and the port at the bottom is an almost enclosed horseshoe bay. The two are joined by an open wooden tram that has been running since 1913 and is, unavoidably, a good photograph.\n\nThe bay faces roughly north-west, so it holds light late and the water stays calm when the rest of the coast does not — useful when Formentor is being blown sideways.\n\nThe town square in Sóller, with the church facade and cafés under plane trees, is a completely different register from the harbour twenty minutes away. Two locations, one short tram ride, no driving.",
      long_description_es:
        "El valle de Sóller es una hondonada de naranjos y limoneros rodeada de montañas, y el puerto al fondo es una bahía en herradura casi cerrada. Los une un tranvía de madera abierto que circula desde 1913 y que, inevitablemente, es una buena foto.\n\nLa bahía mira más o menos al noroeste, así que aguanta la luz hasta tarde y el agua se mantiene tranquila cuando el resto de la costa no lo está: útil cuando en Formentor sopla de lado.\n\nLa plaza de Sóller, con la fachada de la iglesia y las terrazas bajo los plátanos, es un registro completamente distinto del puerto que está a veinte minutos. Dos escenarios, un trayecto corto en tranvía y nada de coche.",
      best_time: "Late afternoon in the port; morning in the town square",
      best_timeEs: "Última hora de la tarde en el puerto; por la mañana en la plaza del pueblo",
      tips: "The tram runs to a timetable and fills in summer — check times rather than turning up. Parking in the port is easier than in the town.",
      tipsEs:
        "El tranvía funciona con horario y se llena en verano: consulte los horarios en vez de presentarse. Aparcar en el puerto es más fácil que en el pueblo.",
      tags: ["couples", "family", "honeymoon", "engagement"],
      coordinates: { lat: 39.7959, lng: 2.6926 },
      address: "Port de Sóller, Mallorca",
    },
  ],
  ronda: [
    {
      name: "Puente Nuevo",
      description:
        "A stone bridge thrown across a 120-metre gorge that splits the town in two — the most dramatic backdrop in Andalusia.",
      nameEs: "Puente Nuevo",
      descriptionEs:
        "Un puente de piedra sobre un tajo de 120 metros que parte el pueblo en dos: el fondo más dramático de Andalucía.",
      long_description:
        "Ronda sits on a plateau split by El Tajo, a gorge 120 metres deep, and the Puente Nuevo spans it in three arches of pale stone. It took forty years to build and finished in 1793, and nothing else in Spain looks like it.\n\nThere are two completely different photographs here. From the town side you shoot along the bridge with the houses balanced on the cliff edge behind. From the Mirador de Aldehuela, and better still from the path that drops below the bridge, you shoot up at the whole span with the gorge underneath — this is the frame that makes people book Ronda in the first place.\n\nThe path down is steep and gravelly and takes fifteen minutes each way. It is worth every one of them, and it is where the light is best in the late afternoon when the gorge walls go gold.",
      long_description_es:
        "Ronda se asienta sobre una meseta partida por El Tajo, un desfiladero de 120 metros, y el Puente Nuevo lo cruza con tres arcos de piedra clara. Se tardó cuarenta años en construirlo y se terminó en 1793, y no hay nada parecido en España.\n\nAquí hay dos fotografías completamente distintas. Desde el pueblo se dispara a lo largo del puente con las casas asomadas al borde del acantilado detrás. Desde el Mirador de Aldehuela, y mejor aún desde el sendero que baja por debajo del puente, se dispara hacia arriba con todo el vano y el tajo debajo: ese es el encuadre por el que la gente reserva Ronda.\n\nEl sendero de bajada es empinado y con grava, y son quince minutos en cada sentido. Merecen la pena, y es donde mejor está la luz al final de la tarde, cuando las paredes del tajo se vuelven doradas.",
      best_time: "Late afternoon, when the gorge walls take colour",
      best_timeEs: "Al final de la tarde, cuando las paredes del tajo cogen color",
      tips: "The viewpoints on the town side are small and busy at midday. The path below the bridge is steep, loose underfoot and has no railing in places — flat shoes, and not the option to choose in a long dress unless you change at the bottom.",
      tipsEs:
        "Los miradores del lado del pueblo son pequeños y se llenan a mediodía. El sendero de debajo del puente es empinado, con piedra suelta y sin barandilla en algunos tramos: calzado plano, y no es la opción para un vestido largo salvo que se cambie abajo.",
      tags: ["couples", "proposal", "elopement", "engagement"],
      coordinates: { lat: 36.7413, lng: -5.1659 },
      address: "Puente Nuevo, Ronda, Málaga",
    },
    {
      name: "The old town and the Alameda",
      description:
        "Whitewashed lanes on the far side of the bridge, and a clifftop promenade with the whole valley below it.",
      nameEs: "La ciudad vieja y la Alameda",
      descriptionEs:
        "Callejuelas encaladas al otro lado del puente y un paseo sobre el acantilado con todo el valle debajo.",
      long_description:
        "Across the bridge from the newer town, Ronda's old quarter is quiet in a way the viewpoints are not: whitewashed walls, wrought-iron balconies, the Palacio de Mondragón, and lanes that hold shade through the middle of the day.\n\nOn the other side, the Alameda del Tajo is a formal nineteenth-century promenade that ends at a balcony on the cliff edge, looking out over the Serranía. It is the easy version of the Puente Nuevo view — no steep path, railings throughout, and the same valley.\n\nThe two together give a session both registers: enclosed and intimate in the old lanes, then wide open with a hundred kilometres of Andalusia behind you.",
      long_description_es:
        "Al otro lado del puente, el casco antiguo de Ronda está tranquilo de una forma que los miradores no lo están: paredes encaladas, balcones de forja, el Palacio de Mondragón y calles que conservan la sombra a mediodía.\n\nEn el otro extremo, la Alameda del Tajo es un paseo decimonónico que termina en un balcón al borde del acantilado, sobre la Serranía. Es la versión fácil de la vista del Puente Nuevo: sin sendero empinado, con barandilla y el mismo valle.\n\nLos dos juntos dan a la sesión los dos registros: recogido e íntimo en las callejuelas, y después abierto de par en par con cien kilómetros de Andalucía detrás.",
      best_time: "Old lanes at midday, the Alameda balcony an hour before sunset",
      best_timeEs: "Las callejuelas a mediodía, el balcón de la Alameda una hora antes del atardecer",
      tips: "Ronda is a day-trip town — coaches arrive late morning and leave mid-afternoon. Before ten and after five it is a different, much emptier place.",
      tipsEs:
        "Ronda es pueblo de excursión: los autocares llegan a media mañana y se van a media tarde. Antes de las diez y después de las cinco es un sitio distinto y mucho más vacío.",
      tags: ["couples", "family", "solo", "engagement"],
      coordinates: { lat: 36.7371, lng: -5.1663 },
      address: "Ciudad Vieja, Ronda, Málaga",
    },
  ],

  valencia: [
    {
      name: "City of Arts and Sciences",
      description:
        "White curved shells and shallow reflecting pools — the most futuristic backdrop in Spain, and it doubles everything.",
      nameEs: "Ciudad de las Artes y las Ciencias",
      descriptionEs:
        "Conchas blancas curvas y láminas de agua poco profundas: el fondo más futurista de España, y duplica todo lo que hay.",
      long_description:
        "Santiago Calatrava's complex on the old riverbed: white concrete and broken-tile shells set in shallow blue pools, on a scale that makes people very small. There is nothing else like it in the country and it photographs unlike anywhere else in this catalogue.\n\nThe pools are the reason to come. Everything reflects, so a low camera position gives you the structure twice, and on a still morning the water is a mirror. The Hemisfèric — the eye-shaped building — and the covered walkways of the Umbracle give you shade and repeating arches when the open plaza is too bright.\n\nWhite concrete in full Valencian sun is genuinely hard: it blows out and it throws light back up into faces. Early morning and the last hour are not a preference here, they are the working hours.",
      long_description_es:
        "El complejo de Santiago Calatrava sobre el antiguo cauce del río: hormigón blanco y trencadís sobre láminas de agua azules, a una escala que empequeñece a las personas. No hay nada igual en el país y se fotografía distinto a todo lo demás de este catálogo.\n\nLas láminas de agua son la razón para venir. Todo se refleja, así que una cámara baja da la estructura dos veces, y en una mañana en calma el agua es un espejo. El Hemisfèric —el edificio con forma de ojo— y las galerías del Umbracle dan sombra y arcos repetidos cuando la explanada está demasiado dura.\n\nEl hormigón blanco a pleno sol valenciano es difícil de verdad: se quema y devuelve luz a las caras. Aquí la primera hora y la última no son una preferencia, son el horario de trabajo.",
      best_time: "Just after sunrise for still water, or the hour before sunset",
      best_timeEs: "Justo después del amanecer para el agua en calma, o la hora antes del atardecer",
      tips: "The outdoor areas and pools are free to walk; only the museums and aquarium are ticketed. Wind ripples the reflections from mid-morning, which is a second reason to be early.",
      tipsEs:
        "Las zonas exteriores y las láminas de agua son de acceso libre; solo se paga por los museos y el oceanográfico. Desde media mañana el viento riza los reflejos, que es otra razón para madrugar.",
      tags: ["couples", "content-creator", "solo", "family"],
      coordinates: { lat: 39.4545, lng: -0.3512 },
      address: "Ciudad de las Artes y las Ciencias, Valencia",
    },
    {
      name: "The Turia gardens",
      description:
        "A nine-kilometre park laid out in a drained riverbed, running under the old bridges through the middle of the city.",
      nameEs: "Los Jardines del Turia",
      descriptionEs:
        "Un parque de nueve kilómetros trazado en el cauce seco del río, que pasa bajo los puentes antiguos por el centro de la ciudad.",
      long_description:
        "After the 1957 flood Valencia moved its river and turned the empty bed into a park that curves right through the city. The result is nine kilometres of gardens, orange trees, palms and lawns, sunk below street level and crossed by the old stone bridges.\n\nBeing sunk is what makes it useful. The banks and the bridges cut the low sun, so there is usable shade through the middle of the day, and the bridge arches give you a built frame at regular intervals.\n\nIt is also flat, wide and traffic-free for its whole length, which makes it the easiest location in this catalogue for families with small children or anyone who does not want to climb anything.",
      long_description_es:
        "Tras la riada de 1957 Valencia desvió su río y convirtió el cauce vacío en un parque que atraviesa la ciudad. El resultado son nueve kilómetros de jardines, naranjos, palmeras y césped, hundidos por debajo del nivel de la calle y cruzados por los puentes de piedra antiguos.\n\nEstar hundido es lo que lo hace útil. Los taludes y los puentes cortan el sol bajo, así que hay sombra aprovechable a mediodía, y los arcos de los puentes dan un marco construido cada pocos cientos de metros.\n\nAdemás es llano, ancho y sin tráfico en todo su recorrido, lo que lo convierte en el sitio más fácil de este catálogo para familias con niños pequeños o para quien no quiera subir nada.",
      best_time: "Any hour — the banks and bridges give shade when the streets do not",
      best_timeEs: "A cualquier hora: los taludes y los puentes dan sombra cuando las calles no",
      tips: "Nine kilometres is too much to walk in a session — pick one stretch. The section between the Palau de la Música and the City of Arts links the two most useful locations in Valencia on foot.",
      tipsEs:
        "Nueve kilómetros son demasiados para una sesión: elija un tramo. El trecho entre el Palau de la Música y la Ciudad de las Artes une a pie los dos mejores escenarios de Valencia.",
      tags: ["family", "couples", "solo", "kids-birthday"],
      coordinates: { lat: 39.4653, lng: -0.3628 },
      address: "Jardí del Túria, Valencia",
    },
  ],
  "san-sebastian": [
    {
      name: "La Concha",
      description:
        "A shell-shaped bay closed by two headlands, edged with the white Belle Époque railing the city is known for.",
      nameEs: "La Concha",
      descriptionEs:
        "Una bahía en forma de concha cerrada por dos montes, bordeada por la barandilla blanca de la Belle Époque.",
      long_description:
        "One of the most complete city beaches in Europe: a near-perfect arc of sand closed at both ends by hills, with Santa Clara island sitting in the middle of the mouth. The promenade above it carries the white balustrade that appears in every photograph of the city, and its repeating curve is a gift to a photographer — a strong line that leads wherever you point it.\n\nThe bay faces north, which is unusual in Spain and changes everything. The light is soft and cool rather than hard and golden, and it stays workable much longer into the middle of the day than an Andalusian location would.\n\nAt low tide the sand runs out a long way and you can shoot on the flat wet beach with the whole bay reflected. At high tide there is almost none, so check the tide table before choosing a time.",
      long_description_es:
        "Una de las playas urbanas más completas de Europa: un arco de arena casi perfecto cerrado por dos montes, con la isla de Santa Clara en mitad de la bocana. El paseo que la bordea lleva la balaustrada blanca que sale en todas las fotos de la ciudad, y su curva repetida es un regalo para un fotógrafo: una línea fuerte que conduce hacia donde se quiera.\n\nLa bahía mira al norte, cosa rara en España, y eso lo cambia todo. La luz es suave y fría en vez de dura y dorada, y aguanta mucho más entrada la mañana que en un sitio andaluz.\n\nCon marea baja la arena se extiende mucho y se puede fotografiar sobre la playa mojada con toda la bahía reflejada. Con marea alta casi no queda arena, así que conviene mirar la tabla de mareas antes de elegir la hora.",
      best_time: "Low tide, at almost any hour — the north-facing light is forgiving",
      best_timeEs: "Con marea baja, a casi cualquier hora: la luz de orientación norte perdona mucho",
      tips: "Check the tide table first; it matters more here than the time of day. The Basque coast is genuinely unpredictable — agree a rain plan when you book rather than on the morning.",
      tipsEs:
        "Mire primero la tabla de mareas: aquí importa más que la hora. La costa vasca es de verdad impredecible; acuerde el plan de lluvia al reservar, no la misma mañana.",
      tags: ["couples", "family", "engagement", "solo"],
      coordinates: { lat: 43.3183, lng: -1.9856 },
      address: "Playa de la Concha, Donostia-San Sebastián",
    },
    {
      name: "Monte Igueldo",
      description:
        "The hill closing the west end of the bay, with the whole shell of La Concha laid out below and a funicular from 1912.",
      nameEs: "Monte Igueldo",
      descriptionEs:
        "El monte que cierra la bahía por el oeste, con toda la concha extendida abajo y un funicular de 1912.",
      long_description:
        "The view every postcard of San Sebastián uses, taken from the top of the western headland: the full arc of the bay, the island in the mouth, and Monte Urgull closing the far side. A wooden funicular has been climbing to it since 1912 and is worth doing for its own sake.\n\nThe viewpoint faces roughly east across the bay, so the best light on the city is early — the sun comes up behind you and lights the whole waterfront. In the evening you are shooting into it, which gives silhouettes rather than the postcard.\n\nThere is an old amusement park at the top, faded in a way that is either charming or the reason to shoot in the other direction.",
      long_description_es:
        "La vista que usa todas las postales de San Sebastián, tomada desde lo alto del monte del oeste: el arco completo de la bahía, la isla en la bocana y el Urgull cerrando el otro lado. Un funicular de madera sube desde 1912 y merece la pena por sí mismo.\n\nEl mirador mira más o menos al este, cruzando la bahía, así que la mejor luz sobre la ciudad es temprana: el sol sale a su espalda e ilumina todo el frente marítimo. Por la tarde se dispara a contraluz, lo que da siluetas en vez de la postal.\n\nArriba hay un parque de atracciones antiguo, desgastado de una forma que resulta encantadora o que es la razón para apuntar en la otra dirección.",
      best_time: "Morning, with the sun behind you lighting the bay",
      best_timeEs: "Por la mañana, con el sol a la espalda iluminando la bahía",
      tips: "The funicular runs to a timetable and closes in bad weather; there is also a road up. The viewpoint terrace charges a small entry fee separate from the funicular ticket.",
      tipsEs:
        "El funicular tiene horario y cierra con mal tiempo; también se sube por carretera. La terraza del mirador cobra una entrada pequeña aparte del billete del funicular.",
      tags: ["couples", "engagement", "solo", "family"],
      coordinates: { lat: 43.3157, lng: -2.0107 },
      address: "Monte Igueldo, Donostia-San Sebastián",
    },
  ],
  ibiza: [
    {
      name: "Dalt Vila",
      description:
        "A walled old town climbing to a cathedral above the port, inside Renaissance ramparts that have never been breached.",
      nameEs: "Dalt Vila",
      descriptionEs:
        "Un casco antiguo amurallado que sube hasta la catedral sobre el puerto, dentro de murallas renacentistas nunca tomadas.",
      long_description:
        "The part of Ibiza that has nothing to do with the island's reputation. A UNESCO-listed walled town of white lanes climbing from the harbour to a cathedral at the top, inside sixteenth-century bastions built to keep out Ottoman raiders.\n\nThe lanes are narrow, steep and white, which means bounced light for most of the day — the same geometry that makes the Albaicín work. The bastions at the top open out to wide views over the port and the sea, so you get the enclosed and the panoramic within a few minutes of each other.\n\nIt is quiet in the morning even in August, because the island's visitors are mostly elsewhere and mostly asleep.",
      long_description_es:
        "La parte de Ibiza que no tiene nada que ver con la fama de la isla. Un casco amurallado declarado Patrimonio de la Humanidad, de calles blancas que suben del puerto a la catedral, dentro de baluartes del siglo XVI levantados contra las incursiones otomanas.\n\nLas calles son estrechas, empinadas y blancas, lo que da luz rebotada casi todo el día: la misma geometría que hace funcionar el Albaicín. Los baluartes de arriba se abren a vistas amplias del puerto y del mar, así que se tiene lo cerrado y lo panorámico a pocos minutos.\n\nPor la mañana está tranquilo incluso en agosto, porque los visitantes de la isla están en otra parte y, en general, durmiendo.",
      best_time: "Morning — quiet even in season, and the lanes hold soft light",
      best_timeEs: "Por la mañana: tranquilo incluso en temporada, y las calles conservan luz suave",
      tips: "Steep cobblestone from the port to the cathedral, about twenty minutes up. Flat shoes for the climb. Vehicle access inside the walls is restricted.",
      tipsEs:
        "Adoquín empinado desde el puerto hasta la catedral, unos veinte minutos de subida. Calzado plano. El acceso de vehículos dentro de las murallas está restringido.",
      tags: ["couples", "engagement", "solo", "content-creator"],
      coordinates: { lat: 38.9067, lng: 1.4361 },
      address: "Dalt Vila, Eivissa, Ibiza",
    },
    {
      name: "Cala Comte at sunset",
      description:
        "A west-coast cove looking out at the islets of Es Vedrà — the most reliable dramatic sunset in Spain.",
      nameEs: "Cala Comte al atardecer",
      descriptionEs:
        "Una cala de la costa oeste frente a los islotes y Es Vedrà: el atardecer más fiable de España.",
      long_description:
        "Low rust-coloured rock terraces stepping down into very clear water, with small islands offshore and the silhouette of Es Vedrà further south. The whole cove faces west, which is the entire point: the sun goes down into the sea directly in front of you, behind the islets.\n\nUnlike most sunset locations this one works from the rock as well as from the sand, so a session is not fighting for space on a beach. The terraces give you levels to place people on and foreground texture that a flat beach cannot.\n\nIt is the best-known sunset on the island, so in July and August it is busy and the parking fills early. May and October give you the identical light with a fraction of the people.",
      long_description_es:
        "Terrazas bajas de roca color óxido que bajan hasta un agua muy clara, con islotes enfrente y la silueta de Es Vedrà más al sur. Toda la cala mira al oeste, y ese es el motivo: el sol se mete en el mar justo delante, por detrás de los islotes.\n\nA diferencia de la mayoría de los sitios de atardecer, este funciona igual desde la roca que desde la arena, así que la sesión no compite por sitio en la playa. Las terrazas dan niveles donde colocar a la gente y una textura de primer plano que una playa llana no tiene.\n\nEs el atardecer más conocido de la isla, así que en julio y agosto hay mucha gente y el aparcamiento se llena pronto. Mayo y octubre dan la misma luz con una fracción del público.",
      best_time: "The hour before sunset, arriving well ahead of it",
      best_timeEs: "La hora antes del atardecer, llegando con bastante antelación",
      tips: "Parking fills long before sunset in season — arrive early or expect a walk. The rock terraces are uneven and slippery when wet; not the place for thin heels.",
      tipsEs:
        "En temporada el aparcamiento se llena mucho antes del atardecer: llegue pronto o cuente con caminar. Las terrazas de roca son irregulares y resbalan mojadas; no es sitio para tacón fino.",
      tags: ["couples", "honeymoon", "engagement", "elopement"],
      coordinates: { lat: 38.9614, lng: 1.2233 },
      address: "Cala Comte, Sant Josep de sa Talaia, Ibiza",
    },
  ],

  toledo: [
    {
      name: "Mirador del Valle",
      description:
        "The whole walled city seen from across the river — cathedral, alcázar and the Tagus wrapped round all of it.",
      nameEs: "Mirador del Valle",
      descriptionEs:
        "La ciudad amurallada entera desde el otro lado del río: catedral, alcázar y el Tajo rodeándolo todo.",
      long_description:
        "Toledo sits on a granite hill inside a loop of the Tagus, and this viewpoint on the far bank is where you see that fact. The whole city stacks up in one frame — the cathedral spire, the square bulk of the Alcázar, the medieval walls and the river below.\n\nThe city faces roughly north from here, so it takes light across its face for most of the day rather than being backlit. Late afternoon warms the stone; after sunset the whole thing is floodlit and the twenty minutes of blue hour give you a completely different photograph.\n\nIt is a viewpoint on a road rather than a place you stumble into — four kilometres from the centre, and worth the taxi.",
      long_description_es:
        "Toledo se asienta sobre un cerro de granito dentro de un meandro del Tajo, y este mirador de la otra orilla es donde se ve esa realidad. La ciudad entera se apila en un solo encuadre: la aguja de la catedral, el bloque del Alcázar, las murallas medievales y el río abajo.\n\nDesde aquí la ciudad mira más o menos al norte, así que recibe luz de frente casi todo el día en vez de quedar a contraluz. A última hora de la tarde la piedra se calienta; después del atardecer todo queda iluminado y los veinte minutos de hora azul dan una fotografía completamente distinta.\n\nEs un mirador en carretera, no un sitio con el que uno se tropieza: a cuatro kilómetros del centro, y el taxi merece la pena.",
      best_time: "The last hour of light, or twenty minutes after sunset when the city lights up",
      best_timeEs: "La última hora de luz, o veinte minutos después del atardecer cuando la ciudad se ilumina",
      tips: "Four kilometres from the old town along the Carretera de Circunvalación — taxi or car, not a walk. There is a lay-by to park in and it fills at sunset.",
      tipsEs:
        "A cuatro kilómetros del casco por la Carretera de Circunvalación: taxi o coche, no se va andando. Hay un apartadero para aparcar y se llena al atardecer.",
      tags: ["couples", "engagement", "solo", "family"],
      coordinates: { lat: 39.8506, lng: -4.0197 },
      address: "Mirador del Valle, Carretera de Circunvalación, Toledo",
    },
    {
      name: "The old town and Puente de San Martín",
      description:
        "Steep stone lanes between the cathedral and the river, ending at a fourteenth-century bridge with towers at both ends.",
      nameEs: "El casco antiguo y el Puente de San Martín",
      descriptionEs:
        "Callejuelas de piedra empinadas entre la catedral y el río, que terminan en un puente del siglo XIV con torres en ambos extremos.",
      long_description:
        "Toledo's old town is dense, steep and almost entirely stone — narrow lanes where three cultures built on top of each other for a thousand years. The walls are high enough that direct sun rarely reaches the ground, so it holds workable light through the middle of the day when open squares do not.\n\nThe Puente de San Martín at the western edge is the reward for walking down: a fourteenth-century bridge across the Tagus with a fortified tower at each end and the gorge below.\n\nEverything here is uphill on the way back. Plan the route downhill and take the taxi up.",
      long_description_es:
        "El casco de Toledo es denso, empinado y casi todo de piedra: callejuelas donde tres culturas construyeron unas sobre otras durante mil años. Los muros son lo bastante altos para que el sol directo casi nunca llegue al suelo, así que conserva luz aprovechable a mediodía cuando las plazas abiertas no.\n\nEl Puente de San Martín, en el extremo oeste, es la recompensa de bajar: un puente del siglo XIV sobre el Tajo con una torre fortificada en cada punta y el tajo debajo.\n\nAquí todo es cuesta arriba a la vuelta. Plantee el recorrido cuesta abajo y suba en taxi.",
      best_time: "Midday in the lanes; the bridge in the last two hours of light",
      best_timeEs: "Mediodía en las callejuelas; el puente en las dos últimas horas de luz",
      tips: "Cobblestone and steep throughout, and Toledo is a day-trip town — coaches arrive late morning and leave mid-afternoon. Before ten and after five it is a different, much emptier place.",
      tipsEs:
        "Adoquín y cuesta por todas partes, y Toledo es pueblo de excursión: los autocares llegan a media mañana y se van a media tarde. Antes de las diez y después de las cinco es otro sitio, mucho más vacío.",
      tags: ["couples", "solo", "engagement", "family"],
      coordinates: { lat: 39.8571, lng: -4.0361 },
      address: "Puente de San Martín, Toledo",
    },
  ],
  cordoba: [
    {
      name: "The Mezquita",
      description:
        "Eight hundred columns of red-and-white striped arches receding in every direction — an interior unlike anywhere in Europe.",
      nameEs: "La Mezquita",
      descriptionEs:
        "Ochocientas columnas de arcos a franjas rojas y blancas que se pierden en todas direcciones: un interior que no tiene igual en Europa.",
      long_description:
        "A mosque begun in 785, extended for two centuries, and with a cathedral built into the middle of it in the sixteenth century. What that produced is a forest of columns carrying double horseshoe arches banded in brick and stone, repeating in every direction until they disappear into the dark.\n\nIt is one of very few interiors worth building an entire session around. The repetition does the composition for you — stand anyone between the columns and the arches lead the eye to them.\n\nThe light is low and warm and comes from lamps rather than windows, so this is a place for wide apertures and steady hands rather than bright frames. Check the current rules on photography and tripods before you plan around it; they change, and a tripod is normally not permitted.",
      long_description_es:
        "Una mezquita comenzada en 785, ampliada durante dos siglos, y con una catedral construida en el centro en el siglo XVI. El resultado es un bosque de columnas con dobles arcos de herradura a franjas de ladrillo y piedra, repitiéndose en todas direcciones hasta perderse en la penumbra.\n\nEs uno de los poquísimos interiores por los que merece la pena montar una sesión entera. La repetición hace la composición sola: coloque a alguien entre las columnas y los arcos llevan la mirada hasta él.\n\nLa luz es baja, cálida y viene de lámparas, no de ventanas, así que es sitio de diafragmas abiertos y pulso firme, no de encuadres luminosos. Consulte las normas vigentes sobre fotografía y trípodes antes de planificar: cambian, y el trípode normalmente no se permite.",
      best_time: "The first entry slot of the day, before the interior fills",
      best_timeEs: "El primer turno de entrada del día, antes de que se llene el interior",
      tips: "Ticketed with timed entry; the photographer needs their own. There is a free early-morning visiting hour on most days, but conditions on it change — verify before relying on it.",
      tipsEs:
        "Entrada con hora; el fotógrafo necesita la suya. Casi todos los días hay una franja matinal de acceso gratuito, pero sus condiciones cambian: compruébelo antes de contar con ella.",
      tags: ["couples", "solo", "engagement"],
      coordinates: { lat: 37.8790, lng: -4.7794 },
      address: "Mezquita-Catedral, Calle Cardenal Herrero, Córdoba",
    },
    {
      name: "The Jewish Quarter and the patios",
      description:
        "Whitewashed lanes hung with flowerpots, and courtyards that open to the public for two weeks every May.",
      nameEs: "La Judería y los patios",
      descriptionEs:
        "Callejuelas encaladas cubiertas de macetas, y patios que abren al público dos semanas cada mayo.",
      long_description:
        "The lanes around the Mezquita are the whitest in Andalusia and the most heavily planted — geraniums and jasmine in blue pots covering entire walls. The Calleja de las Flores narrows to barely a metre and frames the cathedral tower at the end of it, which is the photograph Córdoba is known for.\n\nThe patios themselves are the real thing. Private courtyards behind ordinary front doors, planted floor to roofline, and for two weeks in early May a large number of them open to visitors for the Fiesta de los Patios. It is, without much competition, the best fortnight of the year for photographs in this city.\n\nOutside those two weeks a handful stay open year-round and the lanes are still worth the trip.",
      long_description_es:
        "Las callejuelas alrededor de la Mezquita son las más blancas de Andalucía y las más plantadas: geranios y jazmines en macetas azules cubriendo paredes enteras. La Calleja de las Flores se estrecha hasta apenas un metro y enmarca la torre de la catedral al fondo, que es la foto por la que se conoce Córdoba.\n\nLos patios son lo verdaderamente singular. Patios privados tras puertas corrientes, plantados del suelo al tejado, y durante dos semanas de principios de mayo muchos abren al público por la Fiesta de los Patios. Es, sin mucha competencia, la mejor quincena del año para fotografiar en esta ciudad.\n\nFuera de esas dos semanas unos cuantos siguen abiertos todo el año y las calles merecen igualmente el viaje.",
      best_time: "Early morning for empty lanes; the first half of May for the patios",
      best_timeEs: "Primera hora para las calles vacías; la primera quincena de mayo para los patios",
      tips: "The Calleja de las Flores is very narrow and very popular — first thing or not at all. During the patio festival the courtyards are free but queue, and several ask that you do not photograph the residents.",
      tipsEs:
        "La Calleja de las Flores es muy estrecha y muy concurrida: a primera hora o nada. Durante el festival los patios son gratuitos pero con cola, y en varios piden que no se fotografíe a los vecinos.",
      tags: ["couples", "family", "solo", "engagement"],
      coordinates: { lat: 37.8794, lng: -4.7830 },
      address: "Judería, Córdoba",
    },
  ],
  "costa-brava": [
    {
      name: "Cadaqués",
      description:
        "A white village round a rocky bay at the end of a mountain road — the whitest place on the Catalan coast.",
      nameEs: "Cadaqués",
      descriptionEs:
        "Un pueblo blanco en torno a una bahía rocosa al final de una carretera de montaña: el sitio más blanco de la costa catalana.",
      long_description:
        "Reached over a mountain pass and cut off from the rest of the coast, which is why it still looks like itself. White houses stacked round a bay of dark rock and clear water, black-and-white pebble streets, and boats pulled up on the shingle.\n\nThe whiteness is the point for a photographer: it bounces light back up into faces, so this is one of the few coastal locations that works in the middle of the day rather than only at its ends. Dalí lived in the next cove along at Portlligat, and the landscape he kept painting is the one you will be standing in.\n\nThe road in is slow and the village is small. It rewards half a day rather than a stop.",
      long_description_es:
        "Se llega por un puerto de montaña y está aislado del resto de la costa, que es la razón de que siga pareciéndose a sí mismo. Casas blancas apiladas en torno a una bahía de roca oscura y agua clara, calles de canto rodado en blanco y negro, y barcas varadas en la grava.\n\nEl blanco es lo que importa para un fotógrafo: rebota la luz hacia las caras, así que este es uno de los pocos sitios de costa que funciona a mediodía y no solo en los extremos del día. Dalí vivía en la cala siguiente, en Portlligat, y el paisaje que pintaba una y otra vez es en el que va a estar.\n\nLa carretera de acceso es lenta y el pueblo es pequeño. Compensa medio día, no una parada.",
      best_time: "Works at most hours thanks to the whitewash; best in the last two hours",
      best_timeEs: "Funciona a casi cualquier hora gracias a la cal; mejor en las dos últimas horas",
      tips: "The road in from Roses is winding and slow — allow well over what the distance suggests. Parking is outside the centre and the streets are pebble, which is hard on thin heels.",
      tipsEs:
        "La carretera desde Roses es revirada y lenta: calcule bastante más de lo que sugiere la distancia. El aparcamiento está fuera del centro y las calles son de canto rodado, incómodas con tacón fino.",
      tags: ["couples", "honeymoon", "solo", "engagement"],
      coordinates: { lat: 42.2887, lng: 3.2775 },
      address: "Cadaqués, Alt Empordà, Girona",
    },
    {
      name: "Tossa de Mar and the Camí de Ronda",
      description:
        "A walled medieval town on a headland, with a coastal footpath running out to pine-backed coves either side.",
      nameEs: "Tossa de Mar y el Camí de Ronda",
      descriptionEs:
        "Un pueblo medieval amurallado sobre un promontorio, con un sendero de costa que sale hacia calas rodeadas de pinos a ambos lados.",
      long_description:
        "The Vila Vella is the only fortified medieval town still standing on the Catalan coast: stone walls and round towers on a headland dropping straight into the sea, with the beach curving away below it.\n\nWhat makes Tossa worth a session rather than a photograph is the Camí de Ronda, the coastal path that runs along the cliffs in both directions. Within twenty minutes on foot you are at small coves with pines coming down to the water and no one else in them — the enclosed, intimate frames that the main beach cannot give you.\n\nThe walls take warm light late in the day and the path faces east and west depending which way you walk, so you can choose your light by choosing your direction.",
      long_description_es:
        "La Vila Vella es el único pueblo medieval fortificado que sigue en pie en la costa catalana: murallas de piedra y torres redondas sobre un promontorio que cae al mar, con la playa curvándose debajo.\n\nLo que convierte Tossa en una sesión y no en una foto es el Camí de Ronda, el sendero que recorre los acantilados en ambas direcciones. A veinte minutos a pie hay calas pequeñas con pinos hasta el agua y nadie más en ellas: los encuadres recogidos e íntimos que la playa principal no da.\n\nLas murallas cogen luz cálida al final del día, y el sendero mira al este o al oeste según hacia dónde se camine, así que se elige la luz eligiendo la dirección.",
      best_time: "Late afternoon on the walls; the coves whenever the light suits the direction you walk",
      best_timeEs: "Última hora de la tarde en las murallas; las calas según la dirección que se tome",
      tips: "The Camí de Ronda is a proper footpath — uneven, with steps and no railings in places. Trainers, and not the section to attempt in a long dress without changing at the far end.",
      tipsEs:
        "El Camí de Ronda es un sendero de verdad: irregular, con escalones y sin barandilla en algunos tramos. Zapatilla, y no es el tramo para un vestido largo sin cambiarse al llegar.",
      tags: ["couples", "family", "honeymoon", "elopement"],
      coordinates: { lat: 41.7203, lng: 2.9317 },
      address: "Vila Vella, Tossa de Mar, Girona",
    },
  ],
};

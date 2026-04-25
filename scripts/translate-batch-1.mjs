// Manual batch translations — top 5 founding photographers (Vika, Chris, Sophie, Aleksandra, Monica)
// Translates bio + tagline. Packages handled in a separate batch.

import pg from "pg";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync("/var/www/photoportugal/.env", "utf-8")
    .split("\n").filter((l) => l && l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim().replace(/^["']|["']$/g, "")]; }),
);

const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

const PHOTOGRAPHERS = [
  {
    id: "6d750e7c-ddf2-4cbc-8965-370a374fb938", // Vika Emerson
    tagline: { pt: null, de: null, es: null, fr: null }, // No tagline
    bio: {
      pt: "Adoro o que faço e fotografo memórias de férias com um olhar artístico, capturando momentos autênticos.",
      de: "Ich liebe meinen Beruf und fotografiere Urlaubserinnerungen mit künstlerischem Blick — und halte authentische Momente fest.",
      es: "Amo mi trabajo y fotografío recuerdos de vacaciones con una mirada artística, capturando momentos auténticos.",
      fr: "J'adore mon métier et photographie les souvenirs de vacances avec un regard artistique, en capturant des moments authentiques.",
    },
  },
  {
    id: "58562476-5e69-4b40-a367-50ee61d19886", // Chris Batista
    tagline: {
      pt: "Tire fotografias profissionais das suas férias! Para além de preservar estas memórias para sempre, irá descobrir lugares e percorrer ruas que talvez não conhecesse nos seus passeios.",
      de: "Lassen Sie Ihren Urlaub professionell fotografieren! Sie bewahren diese Erinnerungen für immer und entdecken zugleich Orte und Straßen, die Sie sonst nie gesehen hätten.",
      es: "¡Tome fotos profesionales de sus vacaciones! Además de conservar estos recuerdos para siempre, descubrirá lugares y caminará por calles que de otro modo se perdería.",
      fr: "Faites des photos professionnelles de vos vacances ! En plus de préserver ces souvenirs pour toujours, vous découvrirez des lieux et des rues que vous n'auriez pas remarqués autrement.",
    },
    bio: {
      pt: "Olá! Sou o Chris, fotógrafo brasileiro baseado no Porto, especializado em capturar viajantes nos seus momentos mais naturais.\nPara quem não gosta de poses mas mesmo assim quer fotografias bonitas.\nOfereço uma experiência fotográfica descontraída no Porto, focada na conexão real e em momentos naturais.\nNão vai apenas receber fotos — vai gostar de aparecer nelas.",
      de: "Hallo! Ich bin Chris, ein brasilianischer Fotograf aus Porto, spezialisiert darauf, Reisende in ihren natürlichsten Momenten festzuhalten.\nFür Menschen, die nicht gerne posieren, aber trotzdem schöne Fotos möchten.\nIch biete ein entspanntes Foto-Erlebnis in Porto, mit Fokus auf echte Verbindung und natürliche Momente.\nSie bekommen nicht nur Fotos — Sie werden es genießen, darauf zu sein.",
      es: "¡Hola! Soy Chris, un fotógrafo brasileño afincado en Oporto, especializado en capturar a viajeros en sus momentos más naturales.\nPara quienes no les gusta posar pero aun así quieren fotos bonitas.\nOfrezco una experiencia fotográfica relajada en Oporto, centrada en la conexión real y los momentos naturales.\nNo solo recibirá fotos — disfrutará de aparecer en ellas.",
      fr: "Bonjour ! Je suis Chris, photographe brésilien basé à Porto, spécialisé dans la capture des voyageurs dans leurs moments les plus naturels.\nPour celles et ceux qui n'aiment pas poser mais veulent quand même de belles photos.\nJe propose une expérience photo détendue à Porto, axée sur la connexion réelle et les instants naturels.\nVous n'aurez pas que des photos — vous prendrez plaisir à y apparaître.",
    },
  },
  {
    id: "a89042f8-9ec9-489c-a304-d1f71f5821d8", // Sophie Bellmann
    tagline: {
      pt: "Fotografia artística e natural para o seu tempo em Lisboa",
      de: "Künstlerische und natürliche Fotografie für Ihre Zeit in Lissabon",
      es: "Fotografía artística y natural para su tiempo en Lisboa",
      fr: "Photographie artistique et naturelle pour votre séjour à Lisbonne",
    },
    bio: {
      pt: "Olá, sou a Sophie, fotógrafa e cineasta baseada em Lisboa.\n\nCrio sessões fotográficas naturais e artísticas para casais, famílias e individuais que querem capturar o seu tempo em Portugal de uma forma honesta e significativa.\n\nA minha abordagem é calma e guiada — não precisa de qualquer experiência diante da câmara. Ajudo-o(a) a sentir-se confortável e presente, para criarmos imagens autênticas e pessoais.\n\nAs sessões podem decorrer em Lisboa ou nas belas praias da Costa da Caparica e Fonte da Telha. Quer viaje em casal, em família ou sozinho(a), foco-me em capturar momentos reais, conexão e atmosfera.\n\nTambém ofereço sessões de retrato mais artísticas, incluindo estúdio e fotografia subaquática.",
      de: "Hallo, ich bin Sophie, Fotografin und Filmemacherin in Lissabon.\n\nIch gestalte natürliche, künstlerische Fotosessions für Paare, Familien und Einzelpersonen, die ihre Zeit in Portugal auf ehrliche und bedeutungsvolle Weise festhalten möchten.\n\nMein Ansatz ist ruhig und geführt — Sie brauchen keinerlei Erfahrung vor der Kamera. Ich helfe Ihnen, sich wohlzufühlen und präsent zu sein, damit wir authentische, persönliche Bilder schaffen.\n\nDie Sessions können in Lissabon oder an den schönen Stränden rund um Costa da Caparica und Fonte da Telha stattfinden. Ob als Paar, Familie oder alleine reisend — ich konzentriere mich darauf, echte Momente, Verbindung und Atmosphäre einzufangen.\n\nIch biete auch künstlerischere Porträtsessions an, einschließlich Studio- und Unterwasserfotografie.",
      es: "Hola, soy Sophie, fotógrafa y cineasta afincada en Lisboa.\n\nCreo sesiones de fotos naturales y artísticas para parejas, familias e individuales que quieren capturar su tiempo en Portugal de una forma honesta y significativa.\n\nMi enfoque es tranquilo y guiado — no necesita ninguna experiencia frente a la cámara. Le ayudo a sentirse cómodo(a) y presente, para crear imágenes auténticas y personales.\n\nLas sesiones pueden tener lugar en Lisboa o en las hermosas playas de Costa da Caparica y Fonte da Telha. Tanto si viaja en pareja, en familia o en solitario, me centro en capturar momentos reales, conexión y atmósfera.\n\nTambién ofrezco sesiones de retrato más artísticas, incluyendo estudio y fotografía submarina.",
      fr: "Bonjour, je suis Sophie, photographe et réalisatrice basée à Lisbonne.\n\nJe crée des séances photo naturelles et artistiques pour les couples, les familles et les voyageurs solos qui souhaitent capturer leur séjour au Portugal de manière honnête et significative.\n\nMon approche est calme et guidée — vous n'avez besoin d'aucune expérience devant l'objectif. Je vous aide à vous sentir à l'aise et présent(e), pour créer des images authentiques et personnelles.\n\nLes séances peuvent se dérouler à Lisbonne ou sur les belles plages autour de la Costa da Caparica et Fonte da Telha. Que vous voyagiez en couple, en famille ou seul(e), je me concentre sur la capture de moments réels, de connexion et d'atmosphère.\n\nJe propose aussi des séances de portrait plus artistiques, dont du studio et de la photographie sous-marine.",
    },
  },
  {
    id: "e2e54808-2ab8-418d-a7ca-e7cab6ad8bef", // Aleksandra (almare)
    tagline: {
      pt: "Verdadeira experiência de retrato em Lisboa",
      de: "Echtes Lissabon-Porträt-Erlebnis",
      es: "Auténtica experiencia de retrato en Lisboa",
      fr: "Authentique expérience de portrait à Lisbonne",
    },
    bio: {
      pt: "Sou fotógrafa baseada em Lisboa, capturando emoções, luz e momentos autênticos. O meu trabalho é sobre sentir, não posar — criar imagens que contam histórias reais e íntimas. Cada sessão é uma colaboração silenciosa entre a luz, as pessoas e a emoção.",
      de: "Ich bin Fotografin in Lissabon und halte Emotionen, Licht und authentische Momente fest. Meine Arbeit dreht sich um Gefühl statt Pose — Bilder zu schaffen, die echte, intime Geschichten erzählen. Jede Session ist eine stille Zusammenarbeit zwischen Licht, Menschen und Emotion.",
      es: "Soy fotógrafa afincada en Lisboa, capturando emociones, luz y momentos auténticos. Mi trabajo va de sentir más que de posar — crear imágenes que cuentan historias reales e íntimas. Cada sesión es una silenciosa colaboración entre luz, personas y emoción.",
      fr: "Je suis photographe basée à Lisbonne, je capture les émotions, la lumière et les moments authentiques. Mon travail est question de ressenti plutôt que de pose — créer des images qui racontent des histoires vraies et intimes. Chaque séance est une collaboration silencieuse entre la lumière, les personnes et l'émotion.",
    },
  },
  {
    id: "99958a8c-393b-4729-ac13-bbb3012924a0", // Monica Rodrigues
    tagline: {
      pt: "Momentos reais, emoções reais — Fotografia documental",
      de: "Echte Momente, echte Emotionen — Dokumentarfotografie",
      es: "Momentos reales, emociones reales — Fotografía documental",
      fr: "Moments réels, émotions réelles — Photographie documentaire",
    },
    bio: {
      pt: "Olá! Sou a Mónica, fotógrafa documental baseada em Cascais, Portugal, e o coração por trás do Canto da Objectiva.\nA minha fotografia não é sobre poses perfeitas ou cenas encenadas — é sobre vida real, emoções reais e conexões reais. Trabalho num estilo documental/foto-reportagem, capturando os momentos como eles naturalmente acontecem: o riso, os olhares cúmplices, os pequenos detalhes que tornam a sua história única.\nEspecializo-me em maternidade, família, recém-nascido e casais. Trabalho sobretudo em exteriores.\nAs minhas zonas principais são Lisboa, Sintra e Cascais.\n\nO que me move não é criar imagens bonitas para redes sociais — é criar memórias que importam. Fotografias que vai guardar com carinho daqui a anos, que lhe lembrem não só como as coisas pareciam, mas como se sentiam.\nSe procura fotografia autêntica e emocional que capture a essência de quem você é — vamos criar algo bonito juntos!",
      de: "Hallo! Ich bin Mónica, Dokumentarfotografin in Cascais, Portugal, und das Herz hinter Canto da Objectiva.\nMeine Fotografie geht nicht um perfekte Posen oder gestellte Szenen — sondern um das echte Leben, echte Emotionen und echte Verbindungen. Ich arbeite im dokumentarischen/Foto-Reportage-Stil und halte Momente fest, wie sie natürlich entstehen: das Lachen, die leisen Blicke, die kleinen Details, die Ihre Geschichte einzigartig machen.\nIch spezialisiere mich auf Schwangerschafts-, Familien-, Neugeborenen- und Paarfotografie. Hauptsächlich draußen.\nMeine Hauptregionen sind Lissabon, Sintra und Cascais.\n\nWas mich antreibt, sind nicht Bilder, die gut auf Social Media aussehen — sondern Erinnerungen, die zählen. Fotos, die Sie noch in Jahren wertschätzen werden, die Sie nicht nur daran erinnern, wie etwas aussah, sondern wie es sich anfühlte.\nWenn Sie authentische, emotionale Fotografie suchen, die das Wesen dessen einfängt, wer Sie sind — dann lassen Sie uns gemeinsam etwas Schönes schaffen!",
      es: "¡Hola! Soy Mónica, fotógrafa documental afincada en Cascais, Portugal, y el corazón detrás de Canto da Objectiva.\nMi fotografía no va de poses perfectas o escenas montadas — va de vida real, emociones reales y conexiones reales. Trabajo en un estilo documental/foto-reportaje, capturando los momentos tal como ocurren naturalmente: la risa, las miradas cómplices, los pequeños detalles que hacen única su historia.\nMe especializo en maternidad, familia, recién nacido y parejas. Trabajo principalmente en exteriores.\nMis zonas principales son Lisboa, Sintra y Cascais.\n\nLo que me mueve no es crear imágenes que queden bien en redes sociales — es crear recuerdos que importen. Fotografías que atesorará dentro de años, que le recuerden no solo cómo se veían las cosas, sino cómo se sentían.\nSi busca fotografía auténtica y emocional que capture la esencia de quien es — ¡creemos algo hermoso juntos!",
      fr: "Bonjour ! Je suis Mónica, photographe documentaire à Cascais, Portugal, et le cœur derrière Canto da Objectiva.\nMa photographie ne consiste pas à faire de jolies poses ou des scènes mises en scène — c'est la vraie vie, les vraies émotions et les vraies connexions. Je travaille dans un style documentaire/photo-reportage, en capturant les moments tels qu'ils se déroulent naturellement : le rire, les regards complices, les petits détails qui rendent votre histoire unique.\nJe me spécialise en maternité, famille, nouveau-né et couples. Je travaille principalement en extérieur.\nMes zones principales sont Lisbonne, Sintra et Cascais.\n\nCe qui me motive, ce n'est pas créer des images qui font bien sur les réseaux sociaux — c'est créer des souvenirs qui comptent. Des photos que vous chérirez dans des années, qui vous rappelleront non seulement à quoi les choses ressemblaient, mais comment elles se ressentaient.\nSi vous cherchez une photographie authentique et émotionnelle qui capture l'essence de qui vous êtes — créons ensemble quelque chose de beau !",
    },
  },
  {
    id: "9bc694cc-5172-46ab-9ca9-33abfee1e448", // Cindy
    tagline: {
      pt: "Transforme o seu tempo em Lagos em memórias eternas!",
      de: "Verwandeln Sie Ihre Zeit in Lagos in zeitlose Erinnerungen!",
      es: "¡Convierta su tiempo en Lagos en recuerdos para siempre!",
      fr: "Transformez votre séjour à Lagos en souvenirs intemporels !",
    },
    bio: {
      pt: "Olá, sou a Cindy, holandesa, vivi alguns anos no México e agora mudei-me com a minha pequena família para o lindo Algarve. Sou mãe de duas filhas, adoro desporto, natureza, comida & restaurantes, e estar com amigos e família.\n\nA minha abordagem é descontraída e pessoal. Guio-a(o) onde for preciso, mas concentro-me em criar uma atmosfera confortável onde possa simplesmente ser quem é. Sem poses rígidas, apenas conexão real e momentos divertidos! Pode reservar-me para sessões individuais, casais, maternidade, famílias, retiros — ou qualquer ideia. Envie-me uma mensagem e pensamos juntos.\n\nQuer esteja em babymoon, férias ou retiro, o meu objectivo é tornar o seu tempo em Portugal numa óptima memória!",
      de: "Hallo, ich bin Cindy, gebürtige Niederländerin. Ich habe einige Jahre in Mexiko gelebt und bin nun mit meiner kleinen Familie in die wunderschöne Algarve gezogen. Ich bin Mutter zweier Töchter, liebe Sport, Natur, Essen & Restaurants und Zeit mit Freunden und Familie.\n\nMein Ansatz ist entspannt und persönlich. Ich leite Sie an, wo nötig, aber konzentriere mich darauf, eine angenehme Atmosphäre zu schaffen, in der Sie einfach Sie selbst sein können. Keine steifen Posen, nur echte Verbindung und schöne Momente! Sie können mich für Einzel-, Paar-, Schwangerschafts-, Familien- oder Retreat-Shootings buchen — oder jede andere Idee. Schreiben Sie mir, und wir denken gemeinsam.\n\nOb auf Babymoon, im Urlaub oder im Retreat — mein Ziel ist es, Ihre Zeit in Portugal zu einer großartigen Erinnerung zu machen!",
      es: "Hola, soy Cindy, holandesa, viví unos años en México y ahora me he mudado con mi pequeña familia al hermoso Algarve. Soy madre de dos hijas, me encanta el deporte, la naturaleza, la comida & los restaurantes, y simplemente estar con amigos y familia.\n\nMi enfoque es relajado y personal. Le guío donde haga falta, pero me centro en crear un ambiente cómodo donde pueda simplemente ser usted. ¡Sin poses rígidas, solo conexión real y momentos divertidos! Puede reservarme para sesiones individuales, parejas, maternidad, familias, retiros — o cualquier idea. Envíeme un mensaje y lo pensamos juntos.\n\nYa sea en babymoon, vacaciones o retiro, mi objetivo es convertir su tiempo en Portugal en un gran recuerdo.",
      fr: "Bonjour, je suis Cindy, néerlandaise. J'ai vécu quelques années au Mexique et je viens de m'installer avec ma petite famille dans le magnifique Algarve. Je suis maman de deux filles, j'adore le sport, la nature, la cuisine & les restaurants, et simplement passer du temps avec amis et famille.\n\nMon approche est décontractée et personnelle. Je vous guide là où c'est nécessaire, mais je me concentre sur la création d'une ambiance confortable où vous pouvez simplement être vous-même. Pas de poses rigides, juste une vraie connexion et des moments amusants ! Vous pouvez me réserver pour des séances solo, en couple, maternité, famille, retraites — ou toute autre idée. Envoyez-moi un message et on y réfléchit ensemble.\n\nQue ce soit en babymoon, en vacances ou en retraite, mon objectif est de transformer votre séjour au Portugal en un beau souvenir !",
    },
  },
];

for (const p of PHOTOGRAPHERS) {
  const cols = [];
  const params = [];
  for (const loc of ["pt", "de", "es", "fr"]) {
    if (p.tagline[loc]) {
      cols.push(`tagline_${loc} = $${params.length + 1}`);
      params.push(p.tagline[loc]);
    }
    if (p.bio[loc]) {
      cols.push(`bio_${loc} = $${params.length + 1}`);
      params.push(p.bio[loc]);
    }
  }
  if (cols.length === 0) continue;
  cols.push(`translations_updated_at = NOW()`, `translations_dirty = FALSE`);
  params.push(p.id);
  await client.query(`UPDATE photographer_profiles SET ${cols.join(", ")} WHERE id = $${params.length}`, params);
  console.log(`✓ ${p.id}`);
}

await client.end();
console.log("Done — 6 photographers translated.");

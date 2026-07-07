import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { Cormorant_Garamond } from "next/font/google";
import { getShootTypeBySlug, shootTypeLocalized } from "@/lib/shoot-types-data";
import { getReviewsForShootType } from "@/lib/reviews-data";
import { locations } from "@/lib/locations-data";
import { localeAlternates } from "@/lib/seo";
import { queryOne, query } from "@/lib/db";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { maskSurname } from "@/lib/photographer-name";
import { locationImage, unsplashUrl, IMAGE_SIZES } from "@/lib/unsplash-images";
import { WeddingMatchPanel } from "@/components/ui/WeddingMatchPanel";

// Force-dynamic: hero frames and real-wedding stories reshuffle as
// photographers tag work; this is also a paid-ad landing — freshness over
// static weight.
export const dynamic = "force-dynamic";

// Editorial serif for this page only (next/font scopes the load here).
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

// ─── Palette (editorial: ivory / charcoal / bordeaux) ──────────────────
// Used as literal Tailwind arbitrary values; keep the hexes in sync:
// ivory #FAF6F0 · sand #F2EAE0 · charcoal #1F1B17 · bordeaux #6B1F2E
// (hover #581826).

// Profile-level label is consistent in prod ("Wedding"); photo-level tags
// exist in both cases (214 "Wedding" + 43 "wedding" as of 2026-06-12).
const PROFILE_LABELS = ["Wedding"];
const PHOTO_LABELS = ["Wedding", "wedding"];

// Known-good Unsplash fallbacks (ids already used elsewhere in the repo)
// for when fewer than 3 tagged hero frames exist.
const HERO_FALLBACKS = [
  "photo-1606216794079-73f85bbd57d5",
  "photo-1519741497674-611481863552",
  "photo-1532712938310-34cb3982ef74",
];

const IN_PREP: Record<string, string> = {
  en: "in", pt: "em", de: "in", es: "en", fr: "à",
};

// ─── Wedding destinations → /locations/[slug]/wedding ──────────────────
type DestinationReason = { en: string; pt: string; de: string; es: string; fr: string };
const WEDDING_DESTINATIONS: { slug: string; reason: DestinationReason }[] = [
  {
    slug: "sintra",
    reason: {
      en: "Palace venues, fairytale gardens, magical ceremony backdrops",
      pt: "Palácios para casamento, jardins de conto de fadas, cenários de cerimónia mágicos",
      de: "Palast-Locations, märchenhafte Gärten, magische Trauungs-Kulissen",
      es: "Palacios como sede, jardines de cuento, mágicos fondos de ceremonia",
      fr: "Palais comme lieux, jardins féeriques, décors de cérémonie magiques",
    },
  },
  {
    slug: "algarve",
    reason: {
      en: "Clifftop venues, beach ceremonies, golden sunset receptions",
      pt: "Espaços no topo das falésias, cerimónias na praia, receções ao pôr do sol dourado",
      de: "Klippen-Locations, Strand-Trauungen, goldene Sonnenuntergangs-Empfänge",
      es: "Lugares en acantilados, ceremonias en la playa, recepciones al atardecer dorado",
      fr: "Lieux en haut des falaises, cérémonies sur la plage, réceptions au coucher de soleil doré",
    },
  },
  {
    slug: "lisbon",
    reason: {
      en: "Historic palaces, rooftop venues, city-view celebrations",
      pt: "Palácios históricos, espaços em rooftop, celebrações com vista para a cidade",
      de: "Historische Paläste, Rooftop-Locations, Feiern mit Stadtblick",
      es: "Palacios históricos, espacios en azoteas, celebraciones con vistas a la ciudad",
      fr: "Palais historiques, lieux en rooftop, célébrations avec vue sur la ville",
    },
  },
  {
    slug: "douro-valley",
    reason: {
      en: "Vineyard estates, wine country elegance, panoramic terraces",
      pt: "Quintas vinícolas, elegância do país do vinho, terraços panorâmicos",
      de: "Weingüter, Eleganz des Weinlands, Panoramaterrassen",
      es: "Quintas vinícolas, elegancia del país del vino, terrazas panorámicas",
      fr: "Domaines viticoles, élégance du pays du vin, terrasses panoramiques",
    },
  },
  {
    slug: "porto",
    reason: {
      en: "Riverside venues, port-cellar receptions, dramatic Douro light",
      pt: "Espaços à beira-rio, receções em caves de vinho do Porto, luz dramática do Douro",
      de: "Locations am Fluss, Portweinkeller-Empfänge, dramatisches Douro-Licht",
      es: "Espacios junto al río, recepciones en bodegas, luz dramática del Duero",
      fr: "Lieux au bord du fleuve, réceptions dans les caves à porto, lumière spectaculaire du Douro",
    },
  },
  {
    slug: "cascais",
    reason: {
      en: "Ocean-cliff ceremonies, marina receptions, 20 minutes from Lisbon",
      pt: "Cerimónias nas falésias, receções na marina, a 20 minutos de Lisboa",
      de: "Zeremonien an Meeresklippen, Marina-Empfänge, 20 Minuten von Lissabon",
      es: "Ceremonias en acantilados, recepciones en la marina, a 20 minutos de Lisboa",
      fr: "Cérémonies sur les falaises, réceptions à la marina, à 20 minutes de Lisbonne",
    },
  },
  {
    slug: "comporta",
    reason: {
      en: "Bohemian beach weddings, rice paddies, barefoot luxury",
      pt: "Casamentos boémios na praia, arrozais, luxo descalço",
      de: "Bohème-Strandhochzeiten, Reisfelder, Luxus auf nackten Füßen",
      es: "Bodas bohemias en la playa, arrozales, lujo descalzo",
      fr: "Mariages bohèmes sur la plage, rizières, luxe pieds nus",
    },
  },
  {
    slug: "lagos",
    reason: {
      en: "Golden cliffs of Ponta da Piedade, sunset beach ceremonies",
      pt: "Falésias douradas da Ponta da Piedade, cerimónias na praia ao pôr do sol",
      de: "Goldene Klippen der Ponta da Piedade, Strandzeremonien bei Sonnenuntergang",
      es: "Acantilados dorados de Ponta da Piedade, ceremonias en la playa al atardecer",
      fr: "Falaises dorées de Ponta da Piedade, cérémonies sur la plage au coucher du soleil",
    },
  },
  {
    slug: "obidos",
    reason: {
      en: "Medieval walled town, castle ceremonies, bougainvillea lanes",
      pt: "Vila medieval murada, cerimónias no castelo, ruelas de buganvílias",
      de: "Mittelalterliche Stadtmauern, Burg-Zeremonien, Bougainvillea-Gassen",
      es: "Villa medieval amurallada, ceremonias en el castillo, callejuelas de buganvillas",
      fr: "Ville médiévale fortifiée, cérémonies au château, ruelles de bougainvilliers",
    },
  },
  {
    slug: "evora",
    reason: {
      en: "Alentejo estates, Roman temple backdrops, slow golden light",
      pt: "Herdades alentejanas, o Templo Romano como cenário, luz dourada lenta",
      de: "Alentejo-Landgüter, römische Tempel-Kulissen, langsames goldenes Licht",
      es: "Fincas alentejanas, el templo romano de fondo, luz dorada lenta",
      fr: "Domaines de l'Alentejo, temple romain en toile de fond, lumière dorée",
    },
  },
  {
    slug: "madeira",
    reason: {
      en: "Cliff-edge viewpoints, subtropical gardens, island drama",
      pt: "Miradouros sobre falésias, jardins subtropicais, drama de ilha",
      de: "Klippen-Aussichtspunkte, subtropische Gärten, Insel-Dramatik",
      es: "Miradores al borde del acantilado, jardines subtropicales, drama isleño",
      fr: "Belvédères à flanc de falaise, jardins subtropicaux, décor insulaire",
    },
  },
  {
    slug: "azores",
    reason: {
      en: "Crater-lake vows, hydrangea hedges, Europe's wildest backdrop",
      pt: "Votos sobre lagoas de cratera, sebes de hortênsias, o cenário mais selvagem da Europa",
      de: "Eheversprechen an Kraterseen, Hortensienhecken, Europas wildeste Kulisse",
      es: "Votos sobre lagunas de cráter, setos de hortensias, el escenario más salvaje de Europa",
      fr: "Vœux au-dessus des lacs de cratère, haies d'hortensias, le décor le plus sauvage d'Europe",
    },
  },
];

// ─── Page copy — inline per locale (nothing reads messages/*.json) ─────
type Tier = { name: string; hours: string; range: string; bullets: string[] };
type Strings = {
  eyebrow: string;
  heroTitle: [string, string]; // [roman part, italic part]
  heroSub: string;
  heroCta: string;
  trustReviews: (rating: string, count: number) => string;
  trustPhotographers: (n: number) => string;
  findTitle: string;
  findSub: string;
  where: string;
  wherePlaceholder: string;
  whereSearch: string;
  whereNoMatch: string;
  when: string;
  whenPlaceholder: string;
  findCta: string;
  destTitle: string;
  destSub: string;
  destCta: string;
  realTitle: string;
  realSub: string;
  weddingIn: (loc: string) => string;
  photographedBy: string;
  viewProfile: string;
  whyTitle: string;
  why: { title: string; text: string }[];
  reviewsTitle: string;
  investTitle: string;
  investSub: string;
  tiers: Tier[];
  investNote: string;
  faqTitle: string;
  finalTitle: string;
  finalSub: string;
};

const L: Record<string, Strings> = {
  en: {
    eyebrow: "Wedding photographers in Portugal",
    heroTitle: ["Married", "in Portugal"],
    heroSub: "Hand-picked local wedding photographers — from Sintra's palaces to the cliffs of the Algarve.",
    heroCta: "Find your photographer",
    trustReviews: (r, c) => `★ ${r} from ${c} verified reviews`,
    trustPhotographers: (n) => `${n} wedding photographers`,
    findTitle: "Begin with where, and when",
    findSub: "Tell us where you're getting married — we'll show you the photographers who know it by heart.",
    where: "Where",
    wherePlaceholder: "Choose your destination",
    whereSearch: "Search regions & cities",
    whereNoMatch: "No locations found",
    when: "When",
    whenPlaceholder: "We're still deciding",
    findCta: "Show my photographers",
    destTitle: "Where will you get married?",
    destSub: "Twelve destinations, each with its own light. Every page shows the local wedding photographers, their real work, and how to book them.",
    destCta: "Wedding photographers",
    realTitle: "Real weddings",
    realSub: "Not styled shoots. Real couples, real ceremonies — photographed by the people you can book here.",
    weddingIn: (loc) => `Wedding ${loc ? `in ${loc}` : "in Portugal"}`,
    photographedBy: "Photographed by",
    viewProfile: "View profile",
    whyTitle: "Why couples book through Photo Portugal",
    why: [
      {
        title: "Locals who know your venue",
        text: "They've shot the palace, the quinta and the cliff before — they know where the light lands at six in the evening.",
      },
      {
        title: "Verified portfolios, real reviews",
        text: "Every photographer is hand-reviewed before joining. Every rating comes from a couple who actually stood in front of their camera.",
      },
      {
        title: "Book with confidence",
        text: "Dates, payments and conversations live in one place — protected, in your language, from first message to final gallery.",
      },
    ],
    reviewsTitle: "Couples, in their own words",
    investTitle: "What couples invest",
    investSub: "Honest ranges, so you can plan. Each photographer sets their own packages — exact prices are on their profiles.",
    tiers: [
      { name: "Elopement & intimate", hours: "2–3 hours", range: "€1,000 – €1,250", bullets: ["Ceremony, vows and couple portraits", "100+ edited photos", "Private online gallery"] },
      { name: "Half day", hours: "5–6 hours", range: "€1,250 – €1,600", bullets: ["Getting ready through cocktail hour", "250+ edited photos", "Private online gallery"] },
      { name: "Full day", hours: "8–12 hours", range: "€1,600 – €2,000+", bullets: ["From preparations to the last dance", "400+ edited photos", "Second photographer on request"] },
    ],
    investNote: "Typical investment for wedding photography in Portugal.",
    faqTitle: "Good to know",
    finalTitle: "Let's find your photographer",
    finalSub: "Tell us where and when — see who's free for your date.",
  },
  pt: {
    eyebrow: "Fotógrafos de casamento em Portugal",
    heroTitle: ["Casar", "em Portugal"],
    heroSub: "Fotógrafos de casamento locais, escolhidos a dedo — dos palácios de Sintra às falésias do Algarve.",
    heroCta: "Encontrar o vosso fotógrafo",
    trustReviews: (r, c) => `★ ${r} em ${c} avaliações verificadas`,
    trustPhotographers: (n) => `${n} fotógrafos de casamento`,
    findTitle: "Comecem pelo onde, e pelo quando",
    findSub: "Digam-nos onde se vão casar — mostramos os fotógrafos que conhecem o local de cor.",
    where: "Onde",
    wherePlaceholder: "Escolham o destino",
    whereSearch: "Procurar regiões e cidades",
    whereNoMatch: "Nenhuma localização encontrada",
    when: "Quando",
    whenPlaceholder: "Ainda estamos a decidir",
    findCta: "Ver os meus fotógrafos",
    destTitle: "Onde se vão casar?",
    destSub: "Doze destinos, cada um com a sua luz. Cada página mostra os fotógrafos de casamento locais, o seu trabalho real e como reservá-los.",
    destCta: "Fotógrafos de casamento",
    realTitle: "Casamentos reais",
    realSub: "Não são sessões encenadas. Casais reais, cerimónias reais — fotografadas por quem podem reservar aqui.",
    weddingIn: (loc) => `Casamento ${loc ? `em ${loc}` : "em Portugal"}`,
    photographedBy: "Fotografado por",
    viewProfile: "Ver perfil",
    whyTitle: "Porque é que os casais reservam na Photo Portugal",
    why: [
      {
        title: "Locais que conhecem o vosso espaço",
        text: "Já fotografaram o palácio, a quinta e a falésia — sabem onde a luz cai às seis da tarde.",
      },
      {
        title: "Portefólios verificados, avaliações reais",
        text: "Cada fotógrafo é avaliado à mão antes de entrar. Cada classificação vem de um casal que esteve mesmo à frente da câmara.",
      },
      {
        title: "Reservem com confiança",
        text: "Datas, pagamentos e conversas num só lugar — protegidos, na vossa língua, da primeira mensagem à galeria final.",
      },
    ],
    reviewsTitle: "Casais, pelas suas palavras",
    investTitle: "O que os casais investem",
    investSub: "Intervalos honestos, para poderem planear. Cada fotógrafo define os seus pacotes — os preços exatos estão nos perfis.",
    tiers: [
      { name: "Elopement & intimista", hours: "2–3 horas", range: "1.000 € – 1.250 €", bullets: ["Cerimónia, votos e retratos do casal", "Mais de 100 fotos editadas", "Galeria online privada"] },
      { name: "Meio dia", hours: "5–6 horas", range: "1.250 € – 1.600 €", bullets: ["Dos preparativos ao cocktail", "Mais de 250 fotos editadas", "Galeria online privada"] },
      { name: "Dia inteiro", hours: "8–12 horas", range: "1.600 € – 2.000 €+", bullets: ["Dos preparativos à última dança", "Mais de 400 fotos editadas", "Segundo fotógrafo a pedido"] },
    ],
    investNote: "Investimento típico em fotografia de casamento em Portugal.",
    faqTitle: "Bom saber",
    finalTitle: "Vamos encontrar o vosso fotógrafo",
    finalSub: "Digam-nos onde e quando — vejam quem está livre na vossa data.",
  },
  de: {
    eyebrow: "Hochzeitsfotografen in Portugal",
    heroTitle: ["Heiraten", "in Portugal"],
    heroSub: "Handverlesene lokale Hochzeitsfotografen — von Sintras Palästen bis zu den Klippen der Algarve.",
    heroCta: "Euren Fotografen finden",
    trustReviews: (r, c) => `★ ${r} aus ${c} verifizierten Bewertungen`,
    trustPhotographers: (n) => `${n} Hochzeitsfotografen`,
    findTitle: "Beginnt mit dem Wo, und dem Wann",
    findSub: "Sagt uns, wo ihr heiratet — wir zeigen euch die Fotografen, die den Ort in- und auswendig kennen.",
    where: "Wo",
    wherePlaceholder: "Reiseziel wählen",
    whereSearch: "Regionen & Städte suchen",
    whereNoMatch: "Keine Orte gefunden",
    when: "Wann",
    whenPlaceholder: "Wir überlegen noch",
    findCta: "Meine Fotografen anzeigen",
    destTitle: "Wo werdet ihr heiraten?",
    destSub: "Zwölf Reiseziele, jedes mit eigenem Licht. Jede Seite zeigt die lokalen Hochzeitsfotografen, ihre echten Arbeiten und wie man sie bucht.",
    destCta: "Hochzeitsfotografen",
    realTitle: "Echte Hochzeiten",
    realSub: "Keine gestellten Shootings. Echte Paare, echte Zeremonien — fotografiert von denen, die ihr hier buchen könnt.",
    weddingIn: (loc) => `Hochzeit ${loc ? `in ${loc}` : "in Portugal"}`,
    photographedBy: "Fotografiert von",
    viewProfile: "Profil ansehen",
    whyTitle: "Warum Paare über Photo Portugal buchen",
    why: [
      {
        title: "Locals, die eure Location kennen",
        text: "Sie haben den Palast, die Quinta und die Klippe schon fotografiert — sie wissen, wo das Licht um sechs Uhr abends fällt.",
      },
      {
        title: "Verifizierte Portfolios, echte Bewertungen",
        text: "Jeder Fotograf wird vor der Aufnahme persönlich geprüft. Jede Bewertung stammt von einem Paar, das wirklich vor seiner Kamera stand.",
      },
      {
        title: "Mit Sicherheit buchen",
        text: "Termine, Zahlungen und Gespräche an einem Ort — geschützt, in eurer Sprache, von der ersten Nachricht bis zur fertigen Galerie.",
      },
    ],
    reviewsTitle: "Paare, in ihren eigenen Worten",
    investTitle: "Was Paare investieren",
    investSub: "Ehrliche Spannen, damit ihr planen könnt. Jeder Fotograf legt seine Pakete selbst fest — genaue Preise stehen im Profil.",
    tiers: [
      { name: "Elopement & intim", hours: "2–3 Stunden", range: "1.000 € – 1.250 €", bullets: ["Zeremonie, Eheversprechen und Paarporträts", "100+ bearbeitete Fotos", "Private Online-Galerie"] },
      { name: "Halber Tag", hours: "5–6 Stunden", range: "1.250 € – 1.600 €", bullets: ["Vom Getting-Ready bis zum Sektempfang", "250+ bearbeitete Fotos", "Private Online-Galerie"] },
      { name: "Ganzer Tag", hours: "8–12 Stunden", range: "1.600 € – 2.000 €+", bullets: ["Von den Vorbereitungen bis zum letzten Tanz", "400+ bearbeitete Fotos", "Zweiter Fotograf auf Anfrage"] },
    ],
    investNote: "Typische Investition für Hochzeitsfotografie in Portugal.",
    faqTitle: "Gut zu wissen",
    finalTitle: "Finden wir euren Fotografen",
    finalSub: "Sagt uns wo und wann — seht, wer an eurem Datum frei ist.",
  },
  es: {
    eyebrow: "Fotógrafos de boda en Portugal",
    heroTitle: ["Casarse", "en Portugal"],
    heroSub: "Fotógrafos de boda locales, escogidos a mano — de los palacios de Sintra a los acantilados del Algarve.",
    heroCta: "Encontrad a vuestro fotógrafo",
    trustReviews: (r, c) => `★ ${r} de ${c} reseñas verificadas`,
    trustPhotographers: (n) => `${n} fotógrafos de boda`,
    findTitle: "Empezad por el dónde, y el cuándo",
    findSub: "Decidnos dónde os casáis — os mostramos los fotógrafos que conocen el lugar de memoria.",
    where: "Dónde",
    wherePlaceholder: "Elegid el destino",
    whereSearch: "Buscar regiones y ciudades",
    whereNoMatch: "No se encontraron lugares",
    when: "Cuándo",
    whenPlaceholder: "Aún lo estamos decidiendo",
    findCta: "Ver mis fotógrafos",
    destTitle: "¿Dónde os casaréis?",
    destSub: "Doce destinos, cada uno con su luz. Cada página muestra los fotógrafos de boda locales, su trabajo real y cómo reservarlos.",
    destCta: "Fotógrafos de boda",
    realTitle: "Bodas reales",
    realSub: "No son sesiones de estilismo. Parejas reales, ceremonias reales — fotografiadas por quienes podéis reservar aquí.",
    weddingIn: (loc) => `Boda ${loc ? `en ${loc}` : "en Portugal"}`,
    photographedBy: "Fotografiado por",
    viewProfile: "Ver perfil",
    whyTitle: "Por qué las parejas reservan en Photo Portugal",
    why: [
      {
        title: "Locales que conocen vuestro espacio",
        text: "Ya han fotografiado el palacio, la quinta y el acantilado — saben dónde cae la luz a las seis de la tarde.",
      },
      {
        title: "Portfolios verificados, reseñas reales",
        text: "Cada fotógrafo se revisa a mano antes de entrar. Cada valoración viene de una pareja que estuvo de verdad ante su cámara.",
      },
      {
        title: "Reservad con confianza",
        text: "Fechas, pagos y conversaciones en un solo lugar — protegidos, en vuestro idioma, del primer mensaje a la galería final.",
      },
    ],
    reviewsTitle: "Parejas, en sus propias palabras",
    investTitle: "Lo que invierten las parejas",
    investSub: "Rangos honestos, para que podáis planificar. Cada fotógrafo define sus paquetes — los precios exactos están en su perfil.",
    tiers: [
      { name: "Elopement e íntima", hours: "2–3 horas", range: "1.000 € – 1.250 €", bullets: ["Ceremonia, votos y retratos de pareja", "Más de 100 fotos editadas", "Galería online privada"] },
      { name: "Medio día", hours: "5–6 horas", range: "1.250 € – 1.600 €", bullets: ["De los preparativos al cóctel", "Más de 250 fotos editadas", "Galería online privada"] },
      { name: "Día completo", hours: "8–12 horas", range: "1.600 € – 2.000 €+", bullets: ["De los preparativos al último baile", "Más de 400 fotos editadas", "Segundo fotógrafo bajo petición"] },
    ],
    investNote: "Inversión típica en fotografía de boda en Portugal.",
    faqTitle: "Conviene saber",
    finalTitle: "Encontremos a vuestro fotógrafo",
    finalSub: "Decidnos dónde y cuándo — ved quién está libre en vuestra fecha.",
  },
  fr: {
    eyebrow: "Photographes de mariage au Portugal",
    heroTitle: ["Se marier", "au Portugal"],
    heroSub: "Des photographes de mariage locaux, triés sur le volet — des palais de Sintra aux falaises de l'Algarve.",
    heroCta: "Trouver votre photographe",
    trustReviews: (r, c) => `★ ${r} sur ${c} avis vérifiés`,
    trustPhotographers: (n) => `${n} photographes de mariage`,
    findTitle: "Commencez par le où, et le quand",
    findSub: "Dites-nous où vous vous mariez — nous vous montrons les photographes qui connaissent le lieu par cœur.",
    where: "Où",
    wherePlaceholder: "Choisissez votre destination",
    whereSearch: "Rechercher régions et villes",
    whereNoMatch: "Aucun lieu trouvé",
    when: "Quand",
    whenPlaceholder: "Nous hésitons encore",
    findCta: "Voir mes photographes",
    destTitle: "Où allez-vous vous marier ?",
    destSub: "Douze destinations, chacune avec sa lumière. Chaque page présente les photographes de mariage locaux, leur vrai travail et comment les réserver.",
    destCta: "Photographes de mariage",
    realTitle: "Vrais mariages",
    realSub: "Pas de séances stylisées. De vrais couples, de vraies cérémonies — photographiés par ceux que vous pouvez réserver ici.",
    weddingIn: (loc) => `Mariage ${loc ? `à ${loc}` : "au Portugal"}`,
    photographedBy: "Photographié par",
    viewProfile: "Voir le profil",
    whyTitle: "Pourquoi les couples réservent via Photo Portugal",
    why: [
      {
        title: "Des locaux qui connaissent votre lieu",
        text: "Ils ont déjà photographié le palais, la quinta et la falaise — ils savent où tombe la lumière à six heures du soir.",
      },
      {
        title: "Portfolios vérifiés, vrais avis",
        text: "Chaque photographe est examiné à la main avant de rejoindre la plateforme. Chaque note vient d'un couple qui s'est vraiment tenu devant son objectif.",
      },
      {
        title: "Réservez en confiance",
        text: "Dates, paiements et conversations au même endroit — protégés, dans votre langue, du premier message à la galerie finale.",
      },
    ],
    reviewsTitle: "Des couples, avec leurs mots",
    investTitle: "Ce que les couples investissent",
    investSub: "Des fourchettes honnêtes, pour planifier. Chaque photographe définit ses forfaits — les prix exacts sont sur leur profil.",
    tiers: [
      { name: "Elopement & intime", hours: "2–3 heures", range: "1 000 € – 1 250 €", bullets: ["Cérémonie, vœux et portraits de couple", "Plus de 100 photos retouchées", "Galerie en ligne privée"] },
      { name: "Demi-journée", hours: "5–6 heures", range: "1 250 € – 1 600 €", bullets: ["Des préparatifs au cocktail", "Plus de 250 photos retouchées", "Galerie en ligne privée"] },
      { name: "Journée complète", hours: "8–12 heures", range: "1 600 € – 2 000 €+", bullets: ["Des préparatifs à la dernière danse", "Plus de 400 photos retouchées", "Second photographe sur demande"] },
    ],
    investNote: "Investissement typique pour la photographie de mariage au Portugal.",
    faqTitle: "Bon à savoir",
    finalTitle: "Trouvons votre photographe",
    finalSub: "Dites-nous où et quand — voyez qui est libre à votre date.",
  },
};

const LOCALE_TAGS: Record<string, string> = {
  en: "en-GB", pt: "pt-PT", de: "de-DE", es: "es-ES", fr: "fr-FR",
};

function localizedLocationName(slug: string, locale: string): string {
  const loc = locations.find((l) => l.slug === slug);
  if (!loc) return slug;
  const locR = loc as unknown as Record<string, string | undefined>;
  return locR[`name_${locale}`] || loc.name;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const shootType = getShootTypeBySlug("wedding");
  if (!shootType) return {};
  const loc = shootTypeLocalized(shootType, locale);

  return {
    title: loc.title,
    description: loc.metaDescription,
    alternates: localeAlternates("/weddings", locale),
    openGraph: {
      title: loc.title,
      description: loc.metaDescription,
      type: "website",
      url: "https://photoportugal.com/weddings",
    },
  };
}

export default async function WeddingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const shootType = getShootTypeBySlug("wedding")!;
  const stl = shootTypeLocalized(shootType, locale);
  const ll = L[locale] || L.en;
  const inPrep = IN_PREP[locale] || "in";
  const reasonKey = (locale in L ? locale : "en") as keyof DestinationReason;

  // ─── Stats (live) ──────────────────────────────────────────────────
  let photographerCount = 0;
  let avgRating = 0;
  let totalReviews = 0;
  try {
    const row = await queryOne<{ count: string; avg_rating: string | null; total_reviews: string }>(
      `SELECT COUNT(DISTINCT pp.id) as count,
              AVG(pp.rating) FILTER (WHERE pp.rating IS NOT NULL AND pp.review_count > 0) as avg_rating,
              COALESCE(SUM(pp.review_count), 0) as total_reviews
       FROM photographer_profiles pp
       WHERE pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND pp.shoot_types && $1::text[]`,
      [PROFILE_LABELS]
    );
    photographerCount = parseInt(row?.count || "0");
    avgRating = row?.avg_rating ? parseFloat(parseFloat(row.avg_rating).toFixed(1)) : 0;
    totalReviews = parseInt(row?.total_reviews || "0");
  } catch {}

  // ─── Hero frames: wedding-tagged photos, tier-weighted random ───────
  let heroPhotos: string[] = [];
  try {
    const rows = await query<{ url: string }>(
      `SELECT pi.url
       FROM portfolio_items pi
       JOIN photographer_profiles pp ON pp.id = pi.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pi.type = 'photo'
         AND pi.shoot_type = ANY($1::text[])
         AND pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
       ORDER BY -LN(RANDOM()) / (CASE
           WHEN pp.is_featured THEN 50
           WHEN pp.is_verified THEN 30
           ELSE 2
         END) ASC
       LIMIT 3`,
      [PHOTO_LABELS]
    );
    heroPhotos = rows.map((r) => r.url);
  } catch {}
  while (heroPhotos.length < 3) {
    heroPhotos.push(unsplashUrl(HERO_FALLBACKS[heroPhotos.length % 3], IMAGE_SIZES.hero));
  }

  // ─── Real weddings: top photographers by tagged wedding work ────────
  type RealWedding = {
    id: string; slug: string; name: string; avatar_url: string | null;
    rating: string; review_count: number; wedding_count: number;
    photos: string[]; top_location: string | null;
  };
  let realWeddings: RealWedding[] = [];
  try {
    realWeddings = await query<RealWedding>(
      `WITH wp AS (
         SELECT pp.id, pp.slug, u.name, u.avatar_url,
                COALESCE(pp.rating, 0)::text as rating,
                COALESCE(pp.review_count, 0) as review_count,
                COUNT(pi.id)::int as wedding_count
         FROM photographer_profiles pp
         JOIN users u ON u.id = pp.user_id
         JOIN portfolio_items pi ON pi.photographer_id = pp.id
           AND pi.type = 'photo' AND pi.shoot_type = ANY($1::text[])
         WHERE pp.is_approved = TRUE
           AND COALESCE(pp.is_test, FALSE) = FALSE
           AND COALESCE(u.is_banned, FALSE) = FALSE
         GROUP BY pp.id, pp.slug, u.name, u.avatar_url, pp.rating, pp.review_count
         HAVING COUNT(pi.id) >= 6
       )
       SELECT wp.*,
              ARRAY(
                SELECT pi.url FROM portfolio_items pi
                WHERE pi.photographer_id = wp.id AND pi.type = 'photo'
                  AND pi.shoot_type = ANY($1::text[])
                ORDER BY pi.sort_order NULLS LAST, pi.created_at
                LIMIT 4
              ) as photos,
              (SELECT pi.location_slug FROM portfolio_items pi
               WHERE pi.photographer_id = wp.id AND pi.shoot_type = ANY($1::text[])
                 AND pi.location_slug IS NOT NULL
               GROUP BY pi.location_slug ORDER BY COUNT(*) DESC LIMIT 1) as top_location
       FROM wp
       ORDER BY wp.wedding_count DESC
       LIMIT 3`,
      [PHOTO_LABELS]
    );
  } catch {}

  // ─── Wedding reviews (profile-level filter) ─────────────────────────
  const allReviews = await getReviewsForShootType(PROFILE_LABELS, 6, locale);
  const quotes = allReviews
    .filter((r) => r.text && r.text.length >= 60)
    .sort((a, b) => Math.abs((a.text?.length || 0) - 220) - Math.abs((b.text?.length || 0) - 220))
    .slice(0, 3)
    .map((r) => ({
      text: r.text!.length > 300 ? `${r.text!.slice(0, r.text!.lastIndexOf(" ", 300))}…` : r.text!,
      name: r.client_name,
      country: r.client_country,
    }));

  // ─── Match panel data ───────────────────────────────────────────────
  // Location slugs actually covered by wedding photographers — the WHERE
  // dropdown hides everything else (no empty locations). Falls back to all
  // location-page slugs if the query fails, so the picker never goes blank.
  let availableSlugs: string[] = [];
  try {
    const rows = await query<{ location_slug: string }>(
      `SELECT DISTINCT pl.location_slug
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND pp.shoot_types && $1::text[]`,
      [PROFILE_LABELS]
    );
    availableSlugs = rows.map((r) => r.location_slug).filter(Boolean);
  } catch {}
  if (availableSlugs.length === 0) availableSlugs = locations.map((l) => l.slug);

  // Slugs that have a real /locations/[slug] page (combo target); anything
  // else the dropdown surfaces (region/grouping node) routes to the catalog.
  const comboSlugs = locations.map((l) => l.slug);

  const monthFmt = new Intl.DateTimeFormat(LOCALE_TAGS[locale] || "en-GB", { month: "long", year: "numeric" });
  const now = new Date();
  const monthOptions = Array.from({ length: 18 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
    const label = monthFmt.format(d);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    };
  });
  const panelLabels = {
    where: ll.where,
    wherePlaceholder: ll.wherePlaceholder,
    whereSearch: ll.whereSearch,
    whereNoMatch: ll.whereNoMatch,
    when: ll.when,
    whenPlaceholder: ll.whenPlaceholder,
    cta: ll.findCta,
  };

  // ─── JSON-LD ────────────────────────────────────────────────────────
  const jsonLdService = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Wedding Photography",
    name: stl.title,
    description: stl.metaDescription,
    url: "https://photoportugal.com/weddings",
    provider: { "@type": "Organization", name: "Photo Portugal", url: "https://photoportugal.com" },
    areaServed: { "@type": "Country", name: "Portugal" },
  };
  const jsonLdBusiness = totalReviews > 0 && avgRating > 0 ? {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": "https://photoportugal.com/weddings#business",
    name: `Photo Portugal — ${stl.name}`,
    url: "https://photoportugal.com/weddings",
    image: "https://photoportugal.com/og-image.png",
    description: stl.metaDescription,
    priceRange: "€€€",
    address: { "@type": "PostalAddress", addressLocality: "Lisbon", addressCountry: "PT" },
    areaServed: { "@type": "Country", name: "Portugal" },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: avgRating.toFixed(1),
      reviewCount: String(totalReviews),
      bestRating: "5",
      worstRating: "1",
    },
  } : null;
  const jsonLdFaq = stl.faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: stl.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;

  const bigDest = WEDDING_DESTINATIONS.slice(0, 2);
  const smallDest = WEDDING_DESTINATIONS.slice(2);

  return (
    <div className="bg-[#FAF6F0] text-[#1F1B17]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdService) }} />
      {jsonLdBusiness && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBusiness) }} />
      )}
      {jsonLdFaq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      )}
      {/* Hero crossfade + load-rise keyframes (page-scoped) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ppwFade { 0% { opacity: 0 } 7% { opacity: 1 } 33% { opacity: 1 } 40% { opacity: 0 } 100% { opacity: 0 } }
        @keyframes ppwRise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: translateY(0) } }
        .ppw-rise { opacity: 0; animation: ppwRise 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards }
      ` }} />

      {/* ═══ 1. HERO — cinematic, full viewport ═══ */}
      <section className="relative flex min-h-[calc(100svh-4rem)] items-end overflow-hidden bg-[#1F1B17]">
        {/* Base frame always visible; frames 2-3 crossfade above it */}
        <div className="absolute inset-0">
          <OptimizedImage src={heroPhotos[0]} alt={stl.h1} className="h-full w-full object-cover" />
        </div>
        {heroPhotos.slice(1, 3).map((url, i) => (
          <div
            key={i}
            className="absolute inset-0"
            style={{ opacity: 0, animation: `ppwFade 21s linear ${i * 7}s infinite` }}
          >
            <OptimizedImage src={url} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />

        <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 pt-40 sm:px-8 sm:pb-20">
          <p className="ppw-rise text-[11px] font-semibold uppercase tracking-[0.35em] text-white/75" style={{ animationDelay: "0.1s" }}>
            {ll.eyebrow}
          </p>
          <h1
            className={`${serif.className} ppw-rise mt-5 max-w-3xl text-5xl font-medium leading-[1.04] text-white sm:text-7xl lg:text-8xl`}
            style={{ animationDelay: "0.25s" }}
          >
            {ll.heroTitle[0]} <em className="italic">{ll.heroTitle[1]}</em>
          </h1>
          <p className="ppw-rise mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg" style={{ animationDelay: "0.4s" }}>
            {ll.heroSub}
          </p>
          <div className="ppw-rise mt-9 flex flex-wrap items-center gap-6" style={{ animationDelay: "0.55s" }}>
            <a
              href="#find"
              className="inline-flex items-center gap-2 bg-white px-8 py-4 text-sm font-semibold tracking-wide text-[#6B1F2E] transition hover:bg-[#FAF6F0]"
            >
              {ll.heroCta}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </a>
            <div className="text-sm text-white/75">
              {avgRating > 0 && totalReviews > 0 && (
                <span>{ll.trustReviews(avgRating.toFixed(1), totalReviews)}</span>
              )}
              {avgRating > 0 && totalReviews > 0 && photographerCount > 0 && <span aria-hidden> · </span>}
              {photographerCount > 0 && <span>{ll.trustPhotographers(photographerCount)}</span>}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 2. FIND — where + when ═══ */}
      <section id="find" className="scroll-mt-20 border-b border-[#1F1B17]/10">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6B1F2E]">
            Photo Portugal · {stl.name}
          </p>
          <h2 className={`${serif.className} mt-4 text-4xl font-medium sm:text-5xl`}>{ll.findTitle}</h2>
          <p className="mt-4 max-w-xl text-[#1F1B17]/65">{ll.findSub}</p>
          <div className="mt-10">
            <WeddingMatchPanel
              comboSlugs={comboSlugs}
              availableSlugs={availableSlugs}
              months={monthOptions}
              labels={panelLabels}
              variant="light"
              source="weddings_hero"
            />
          </div>
        </div>
      </section>

      {/* ═══ 3. DESTINATIONS — editorial asymmetric grid ═══ */}
      <section>
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className={`${serif.className} text-4xl font-medium sm:text-5xl`}>{ll.destTitle}</h2>
              <p className="mt-4 max-w-2xl text-[#1F1B17]/65">{ll.destSub}</p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {bigDest.map((dest) => {
              const locName = localizedLocationName(dest.slug, locale);
              return (
                <Link
                  key={dest.slug}
                  href={`/locations/${dest.slug}/wedding`}
                  className="group relative col-span-2 overflow-hidden"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[#F2EAE0] sm:aspect-[16/10]">
                    <OptimizedImage
                      src={locationImage(dest.slug, "cardLarge")}
                      alt={`${stl.name} ${inPrep} ${locName}`}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                    <h3 className={`${serif.className} text-3xl font-medium text-white sm:text-4xl`}>{locName}</h3>
                    <p className="mt-1.5 max-w-md text-sm leading-snug text-white/80">{dest.reason[reasonKey]}</p>
                    <span className="mt-3 inline-flex items-center gap-1.5 border-b border-white/40 pb-0.5 text-[13px] font-semibold tracking-wide text-white transition group-hover:border-white">
                      {ll.destCta}
                      <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </span>
                  </div>
                </Link>
              );
            })}

            {smallDest.map((dest) => {
              const locName = localizedLocationName(dest.slug, locale);
              return (
                <Link
                  key={dest.slug}
                  href={`/locations/${dest.slug}/wedding`}
                  className="group relative overflow-hidden"
                >
                  <div className="aspect-[4/5] w-full overflow-hidden bg-[#F2EAE0]">
                    <OptimizedImage
                      src={locationImage(dest.slug, "card")}
                      alt={`${stl.name} ${inPrep} ${locName}`}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className={`${serif.className} text-xl font-medium text-white sm:text-2xl`}>{locName}</h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ 4. REAL WEDDINGS — work-first photographer stories ═══ */}
      {realWeddings.length > 0 && (
        <section className="border-y border-[#1F1B17]/10 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <h2 className={`${serif.className} text-4xl font-medium sm:text-5xl`}>{ll.realTitle}</h2>
            <p className="mt-4 max-w-2xl text-[#1F1B17]/65">{ll.realSub}</p>

            <div className="mt-12 space-y-16 sm:space-y-24">
              {realWeddings.map((rw, idx) => {
                const locName = rw.top_location ? localizedLocationName(rw.top_location, locale) : "";
                const reversed = idx % 2 === 1;
                return (
                  <article key={rw.id} className={`grid grid-cols-1 items-end gap-5 lg:grid-cols-12 ${reversed ? "" : ""}`}>
                    {/* Lead frame */}
                    <div className={`lg:col-span-7 ${reversed ? "lg:order-2" : ""}`}>
                      <div className="aspect-[4/3] overflow-hidden bg-[#F2EAE0]">
                        <OptimizedImage
                          src={rw.photos[0]}
                          alt={`${ll.weddingIn(locName)} — ${rw.name}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                    {/* Side frames + caption */}
                    <div className={`lg:col-span-5 ${reversed ? "lg:order-1" : ""}`}>
                      <div className="grid grid-cols-2 gap-5">
                        {rw.photos.slice(1, 3).map((url, i) => (
                          <div key={i} className="aspect-[3/4] overflow-hidden bg-[#F2EAE0]">
                            <OptimizedImage src={url} alt="" className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                      <div className="mt-7 border-t border-[#1F1B17]/15 pt-6">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6B1F2E]">
                          {ll.weddingIn(locName)}
                        </p>
                        <p className={`${serif.className} mt-2 text-2xl font-medium sm:text-3xl`}>
                          {ll.photographedBy} {maskSurname(rw.name)}
                        </p>
                        <div className="mt-4 flex items-center gap-3">
                          {rw.avatar_url && (
                            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
                              <OptimizedImage src={rw.avatar_url} alt={rw.name} className="h-full w-full object-cover" />
                            </span>
                          )}
                          {Number(rw.rating) > 0 && rw.review_count > 0 && (
                            <span className="text-sm text-[#1F1B17]/70">
                              ★ {Number(rw.rating).toFixed(1)} ({rw.review_count})
                            </span>
                          )}
                          <Link
                            href={`/photographers/${rw.slug}`}
                            className="ml-auto inline-flex items-center gap-1.5 border-b border-[#6B1F2E]/40 pb-0.5 text-sm font-semibold text-[#6B1F2E] transition hover:border-[#6B1F2E]"
                          >
                            {ll.viewProfile}
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══ 5. WHY — three editorial columns ═══ */}
      <section className="bg-[#F2EAE0]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <h2 className={`${serif.className} max-w-2xl text-4xl font-medium sm:text-5xl`}>{ll.whyTitle}</h2>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
            {ll.why.map((w, i) => (
              <div key={i} className="border-t border-[#1F1B17]/20 pt-6">
                <span className={`${serif.className} text-2xl italic text-[#6B1F2E]`}>
                  {["I.", "II.", "III."][i]}
                </span>
                <h3 className={`${serif.className} mt-3 text-2xl font-medium`}>{w.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#1F1B17]/70">{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6. REVIEWS — large serif quotes ═══ */}
      {quotes.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <h2 className={`${serif.className} text-4xl font-medium sm:text-5xl`}>{ll.reviewsTitle}</h2>
            <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-10">
              {quotes.map((q, i) => (
                <figure key={i}>
                  <span className={`${serif.className} block text-6xl leading-none text-[#6B1F2E]`} aria-hidden>
                    “
                  </span>
                  <blockquote className={`${serif.className} mt-2 text-xl italic leading-relaxed text-[#1F1B17]/85`}>
                    {q.text}
                  </blockquote>
                  <figcaption className="mt-5 text-[13px] font-semibold uppercase tracking-[0.2em] text-[#1F1B17]/55">
                    {q.name}
                    {q.country ? ` · ${q.country}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ 7. INVESTMENT GUIDE ═══ */}
      <section className="border-t border-[#1F1B17]/10">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <h2 className={`${serif.className} text-4xl font-medium sm:text-5xl`}>{ll.investTitle}</h2>
          <p className="mt-4 max-w-2xl text-[#1F1B17]/65">{ll.investSub}</p>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
            {ll.tiers.map((tier, i) => (
              <div key={i} className="border-t-2 border-[#6B1F2E] pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#1F1B17]/55">{tier.hours}</p>
                <h3 className={`${serif.className} mt-2 text-2xl font-medium`}>{tier.name}</h3>
                <p className={`${serif.className} mt-4 text-3xl font-medium text-[#6B1F2E]`}>{tier.range}</p>
                <ul className="mt-5 space-y-2 text-[15px] text-[#1F1B17]/70">
                  {tier.bullets.map((b, j) => (
                    <li key={j} className="flex gap-2.5">
                      <span className="mt-[9px] h-px w-4 shrink-0 bg-[#6B1F2E]/60" aria-hidden />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-10 text-sm text-[#1F1B17]/50">{ll.investNote}</p>
        </div>
      </section>

      {/* ═══ 8. FAQ — editorial rules, serif questions ═══ */}
      {stl.faqs.length > 0 && (
        <section className="border-t border-[#1F1B17]/10 bg-white">
          <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
            <h2 className={`${serif.className} text-4xl font-medium sm:text-5xl`}>{ll.faqTitle}</h2>
            <div className="mt-10">
              {stl.faqs.map((faq, i) => (
                <details key={i} className="group border-b border-[#1F1B17]/15">
                  <summary className={`${serif.className} flex cursor-pointer items-baseline justify-between gap-6 py-6 text-xl font-medium sm:text-2xl`}>
                    {faq.question}
                    <svg className="h-5 w-5 shrink-0 translate-y-1 text-[#6B1F2E] transition group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </summary>
                  <p className="pb-7 pr-10 text-[15px] leading-relaxed text-[#1F1B17]/70">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ 9. FINAL CTA — bordeaux, repeat the panel ═══ */}
      <section className="bg-[#6B1F2E]">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
          <h2 className={`${serif.className} text-4xl font-medium text-white sm:text-5xl`}>{ll.finalTitle}</h2>
          <p className="mt-4 max-w-xl text-white/75">{ll.finalSub}</p>
          <div className="mt-10">
            <WeddingMatchPanel
              comboSlugs={comboSlugs}
              availableSlugs={availableSlugs}
              months={monthOptions}
              labels={panelLabels}
              variant="dark"
              source="weddings_footer"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

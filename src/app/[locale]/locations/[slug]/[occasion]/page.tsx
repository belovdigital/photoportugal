import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getLocationBySlug, getNearbyLocations, locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { localeAlternates } from "@/lib/seo";
import { query, queryOne } from "@/lib/db";
import { Avatar } from "@/components/ui/Avatar";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { normalizeName } from "@/lib/format-name";
import { ScarcityBanner } from "@/components/ui/ScarcityBanner";

export const revalidate = 86400;

type OccasionEntry = {
  title: string;
  titlePt: string;
  titleDe: string;
  titleEs?: string;
  titleFr?: string;
  description: string;
  descriptionPt: string;
  descriptionDe: string;
  descriptionEs?: string;
  descriptionFr?: string;
  emoji: string;
};

const OCCASIONS: Record<string, OccasionEntry> = {
  proposal: {
    title: "Proposal Photographer",
    titlePt: "Fotógrafo de Pedido de Casamento",
    titleDe: "Fotograf für Heiratsantrag",
    titleEs: "Fotógrafo para Pedida de Mano",
    titleFr: "Photographe de demande en mariage",
    description: "Capture your surprise proposal with a professional photographer who will discreetly document every moment of this life-changing event.",
    descriptionPt: "Capture o seu pedido de casamento surpresa com um fotógrafo profissional que documentará discretamente cada momento deste evento.",
    descriptionDe: "Halten Sie Ihren Überraschungsantrag mit einem professionellen Fotografen fest, der jeden Moment dieses bewegenden Ereignisses diskret dokumentiert.",
    descriptionEs: "Capture su pedida sorpresa con un fotógrafo profesional que documentará con discreción cada momento de este evento que cambia la vida.",
    descriptionFr: "Capturez votre demande surprise avec un photographe professionnel qui documentera discrètement chaque instant de ce moment qui change la vie.",
    emoji: "💍",
  },
  honeymoon: {
    title: "Honeymoon Photographer",
    titlePt: "Fotógrafo de Lua de Mel",
    titleDe: "Fotograf für die Flitterwochen",
    titleEs: "Fotógrafo de Luna de Miel",
    titleFr: "Photographe de lune de miel",
    description: "Celebrate your honeymoon with stunning professional photos at the most romantic spots. Natural, candid moments that tell your love story.",
    descriptionPt: "Celebre a sua lua de mel com fotos profissionais deslumbrantes nos locais mais românticos.",
    descriptionDe: "Feiern Sie Ihre Flitterwochen mit traumhaften professionellen Fotos an den romantischsten Orten. Natürliche, unverfälschte Momente, die Ihre Liebesgeschichte erzählen.",
    descriptionEs: "Celebre su luna de miel con fotos profesionales impresionantes en los lugares más románticos. Momentos naturales y espontáneos que cuentan su historia de amor.",
    descriptionFr: "Célébrez votre lune de miel avec de magnifiques photos professionnelles dans les lieux les plus romantiques. Des moments naturels et spontanés qui racontent votre histoire d'amour.",
    emoji: "🥂",
  },
  couples: {
    title: "Couples Photographer",
    titlePt: "Fotógrafo de Casais",
    titleDe: "Paar-Fotograf",
    titleEs: "Fotógrafo de Parejas",
    titleFr: "Photographe de couple",
    description: "Professional couples photography for vacations, anniversaries, and romantic getaways. Relaxed, natural sessions that capture real connection.",
    descriptionPt: "Fotografia profissional de casais para férias, aniversários e escapadelas românticas.",
    descriptionDe: "Professionelle Paarfotografie für Urlaube, Hochzeitstage und romantische Auszeiten. Entspannte, natürliche Sessions, die echte Verbundenheit einfangen.",
    descriptionEs: "Fotografía profesional de parejas para vacaciones, aniversarios y escapadas románticas. Sesiones relajadas y naturales que capturan la conexión real.",
    descriptionFr: "Photographie de couple professionnelle pour les vacances, anniversaires et escapades romantiques. Des séances détendues et naturelles qui capturent la vraie connexion.",
    emoji: "❤️",
  },
  family: {
    title: "Family Photographer",
    titlePt: "Fotógrafo de Família",
    titleDe: "Familienfotograf",
    titleEs: "Fotógrafo de Familias",
    titleFr: "Photographe de famille",
    description: "Kid-friendly family photoshoots with experienced photographers who know how to keep everyone relaxed and capture genuine moments.",
    descriptionPt: "Sessões fotográficas familiares com fotógrafos experientes que sabem captar momentos genuínos.",
    descriptionDe: "Familienfreundliche Fotoshootings mit erfahrenen Fotografen, die wissen, wie alle entspannt bleiben und echte Momente festgehalten werden.",
    descriptionEs: "Sesiones familiares amigables con niños, con fotógrafos experimentados que saben mantener a todos relajados y capturar momentos auténticos.",
    descriptionFr: "Séances de famille adaptées aux enfants, avec des photographes expérimentés qui savent mettre tout le monde à l'aise et capturer des moments authentiques.",
    emoji: "👨‍👩‍👧‍👦",
  },
  solo: {
    title: "Solo Travel Photographer",
    titlePt: "Fotógrafo para Viajantes Solo",
    titleDe: "Fotograf für Alleinreisende",
    titleEs: "Fotógrafo para Viajeros Solos",
    titleFr: "Photographe pour voyageurs solo",
    description: "Professional portraits for solo travelers. Get amazing photos of yourself at iconic locations — no more selfies or asking strangers.",
    descriptionPt: "Retratos profissionais para viajantes solo. Fotos incríveis em locais icónicos.",
    descriptionDe: "Professionelle Porträts für Alleinreisende. Wunderschöne Aufnahmen von Ihnen an ikonischen Orten — keine Selfies, keine Fremden mehr fragen.",
    descriptionEs: "Retratos profesionales para viajeros solos. Consiga fotos increíbles de usted mismo en lugares icónicos — sin selfies ni pedir favores a desconocidos.",
    descriptionFr: "Portraits professionnels pour voyageurs solo. Obtenez de magnifiques photos de vous-même dans des lieux iconiques — fini les selfies et les inconnus.",
    emoji: "🧳",
  },
  engagement: {
    title: "Engagement Photographer",
    titlePt: "Fotógrafo de Noivado",
    titleDe: "Verlobungsfotograf",
    titleEs: "Fotógrafo de Compromiso",
    titleFr: "Photographe de fiançailles",
    description: "Pre-wedding engagement photoshoots at stunning locations. Perfect for save-the-dates, announcements, or simply celebrating your engagement.",
    descriptionPt: "Sessões fotográficas de noivado em locais deslumbrantes.",
    descriptionDe: "Verlobungsfotoshootings vor der Hochzeit an beeindruckenden Orten. Perfekt für Save-the-Dates, Ankündigungen oder einfach zur Feier Ihrer Verlobung.",
    descriptionEs: "Sesiones de compromiso pre-boda en lugares impresionantes. Perfectas para save-the-dates, anuncios o simplemente para celebrar su compromiso.",
    descriptionFr: "Séances de fiançailles avant le mariage dans des lieux magnifiques. Parfaites pour les save-the-dates, annonces ou simplement pour célébrer vos fiançailles.",
    emoji: "💑",
  },
  elopement: {
    title: "Elopement Photographer",
    titlePt: "Fotógrafo de Elopement",
    titleDe: "Elopement-Fotograf",
    titleEs: "Fotógrafo de Boda Íntima",
    titleFr: "Photographe d'elopement",
    description: "Intimate elopement photography for couples choosing to celebrate their love privately in one of the most beautiful countries in Europe.",
    descriptionPt: "Fotografia íntima de elopement para casais que escolhem celebrar o seu amor em privado.",
    descriptionDe: "Intime Elopement-Fotografie für Paare, die ihre Liebe privat in einem der schönsten Länder Europas feiern möchten.",
    descriptionEs: "Fotografía íntima de boda íntima (elopement) para parejas que eligen celebrar su amor en privado en uno de los países más bellos de Europa.",
    descriptionFr: "Photographie intime d'elopement pour les couples qui choisissent de célébrer leur amour en privé dans l'un des plus beaux pays d'Europe.",
    emoji: "🌿",
  },
};

const localeKey: Record<string, "Pt" | "De" | "Es" | "Fr"> = {
  pt: "Pt", de: "De", es: "Es", fr: "Fr",
};

function occTitle(o: OccasionEntry, locale: string) {
  const k = localeKey[locale];
  if (k) {
    const v = o[`title${k}` as keyof OccasionEntry] as string | undefined;
    if (v) return v;
  }
  return o.title;
}
function occDesc(o: OccasionEntry, locale: string) {
  const k = localeKey[locale];
  if (k) {
    const v = o[`description${k}` as keyof OccasionEntry] as string | undefined;
    if (v) return v;
  }
  return o.description;
}

// UI translations for this page (5 locales).
const L = {
  en: {
    metaTitle: (occ: string, loc: string) => `${occ} in ${loc} — Book a Photoshoot`,
    metaDesc: (desc: string, occLower: string, loc: string) =>
      `${desc} Book your ${occLower} in ${loc}. Verified portfolios, instant booking. From €150.`,
    home: "Home",
    locations: "Locations",
    availablePhotographers: (loc: string) => `Available photographers in ${loc}`,
    reviews: "reviews",
    from: "From",
    aboutLocation: (loc: string) => `About ${loc}`,
    otherOccasions: (loc: string) => `Other occasions in ${loc}`,
    nearbyTitle: (occ: string) => `${occ} in nearby destinations`,
    nearbySub: (loc: string) => `Also consider these locations near ${loc}.`,
    inLocation: "in",
    viewPhotographers: "View photographers",
    faqTitle: "Frequently asked questions",
    ctaTitle: (occLower: string, loc: string) => `Ready to book your ${occLower} in ${loc}?`,
    ctaSub: "Browse verified photographers and book in minutes — no commitment, money-back guarantee.",
    ctaBtn: "Browse Photographers",
    ctaSecondary: "Or get matched for free with our concierge",
  },
  pt: {
    metaTitle: (occ: string, loc: string) => `${occ} em ${loc} — Reserve Sessão Fotográfica`,
    metaDesc: (desc: string, occLower: string, loc: string) =>
      `${desc} Reserve o seu ${occLower} em ${loc}. Portfólios verificados, reserva instantânea. Desde 150 €.`,
    home: "Início",
    locations: "Localizações",
    availablePhotographers: (loc: string) => `Fotógrafos disponíveis em ${loc}`,
    reviews: "avaliações",
    from: "Desde",
    aboutLocation: (loc: string) => `Sobre ${loc}`,
    otherOccasions: (loc: string) => `Outras ocasiões em ${loc}`,
    nearbyTitle: (occ: string) => `${occ} em destinos próximos`,
    nearbySub: (loc: string) => `Considere também estas localizações perto de ${loc}.`,
    inLocation: "em",
    viewPhotographers: "Ver fotógrafos",
    faqTitle: "Perguntas frequentes",
    ctaTitle: (occLower: string, loc: string) => `Pronto para reservar o seu ${occLower} em ${loc}?`,
    ctaSub: "Veja fotógrafos verificados e reserve em minutos — sem compromisso, com garantia de reembolso.",
    ctaBtn: "Ver Fotógrafos",
    ctaSecondary: "Ou seja emparelhado gratuitamente pelo nosso concierge",
  },
  de: {
    metaTitle: (occ: string, loc: string) => `${occ} in ${loc} — Fotoshooting buchen`,
    metaDesc: (desc: string, occLower: string, loc: string) =>
      `${desc} Buchen Sie Ihren ${occLower} in ${loc}. Verifizierte Portfolios, sofortige Buchung. Ab 150 €.`,
    home: "Startseite",
    locations: "Orte",
    availablePhotographers: (loc: string) => `Verfügbare Fotografen in ${loc}`,
    reviews: "Bewertungen",
    from: "Ab",
    aboutLocation: (loc: string) => `Über ${loc}`,
    otherOccasions: (loc: string) => `Weitere Anlässe in ${loc}`,
    nearbyTitle: (occ: string) => `${occ} an Orten in der Nähe`,
    nearbySub: (loc: string) => `Schauen Sie sich auch diese Orte in der Nähe von ${loc} an.`,
    inLocation: "in",
    viewPhotographers: "Fotografen ansehen",
    faqTitle: "Häufig gestellte Fragen",
    ctaTitle: (occLower: string, loc: string) => `Bereit, Ihren ${occLower} in ${loc} zu buchen?`,
    ctaSub: "Verifizierte Fotografen ansehen und in wenigen Minuten buchen — unverbindlich, mit Geld-zurück-Garantie.",
    ctaBtn: "Fotografen ansehen",
    ctaSecondary: "Oder lassen Sie sich kostenlos vom Concierge-Team vermitteln",
  },
  es: {
    metaTitle: (occ: string, loc: string) => `${occ} en ${loc} — Reserve su sesión fotográfica`,
    metaDesc: (desc: string, occLower: string, loc: string) =>
      `${desc} Reserve su ${occLower} en ${loc}. Portafolios verificados, reserva al instante. Desde 150 €.`,
    home: "Inicio",
    locations: "Ubicaciones",
    availablePhotographers: (loc: string) => `Fotógrafos disponibles en ${loc}`,
    reviews: "reseñas",
    from: "Desde",
    aboutLocation: (loc: string) => `Sobre ${loc}`,
    otherOccasions: (loc: string) => `Otras ocasiones en ${loc}`,
    nearbyTitle: (occ: string) => `${occ} en destinos cercanos`,
    nearbySub: (loc: string) => `Considere también estos lugares cerca de ${loc}.`,
    inLocation: "en",
    viewPhotographers: "Ver fotógrafos",
    faqTitle: "Preguntas frecuentes",
    ctaTitle: (occLower: string, loc: string) => `¿Listo para reservar su ${occLower} en ${loc}?`,
    ctaSub: "Vea fotógrafos verificados y reserve en minutos — sin compromiso, con garantía de devolución.",
    ctaBtn: "Ver fotógrafos",
    ctaSecondary: "O reciba recomendaciones gratis de nuestro concierge",
  },
  fr: {
    metaTitle: (occ: string, loc: string) => `${occ} à ${loc} — Réservez votre séance photo`,
    metaDesc: (desc: string, occLower: string, loc: string) =>
      `${desc} Réservez votre ${occLower} à ${loc}. Portfolios vérifiés, réservation immédiate. À partir de 150 €.`,
    home: "Accueil",
    locations: "Lieux",
    availablePhotographers: (loc: string) => `Photographes disponibles à ${loc}`,
    reviews: "avis",
    from: "À partir de",
    aboutLocation: (loc: string) => `À propos de ${loc}`,
    otherOccasions: (loc: string) => `Autres occasions à ${loc}`,
    nearbyTitle: (occ: string) => `${occ} dans des destinations proches`,
    nearbySub: (loc: string) => `Pensez aussi à ces lieux près de ${loc}.`,
    inLocation: "à",
    viewPhotographers: "Voir les photographes",
    faqTitle: "Questions fréquentes",
    ctaTitle: (occLower: string, loc: string) => `Prêt à réserver votre ${occLower} à ${loc} ?`,
    ctaSub: "Parcourez les photographes vérifiés et réservez en quelques minutes — sans engagement, avec garantie de remboursement.",
    ctaBtn: "Voir les photographes",
    ctaSecondary: "Ou laissez notre concierge vous proposer des photographes gratuitement",
  },
} as const;

function pickL(locale: string): typeof L.en {
  return (L as unknown as Record<string, typeof L.en>)[locale] || L.en;
}

export async function generateStaticParams() {
  const slugs = locations.map((l) => l.slug);
  const occasions = Object.keys(OCCASIONS);
  return slugs.flatMap((slug) => occasions.map((occasion) => ({ slug, occasion })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string; occasion: string }> }): Promise<Metadata> {
  const { locale, slug, occasion } = await params;
  const location = getLocationBySlug(slug);
  const occ = OCCASIONS[occasion];
  if (!location || !occ) return {};

  const t = pickL(locale);
  const occT = occTitle(occ, locale);
  const occD = occDesc(occ, locale);
  const locName = ((location as unknown as Record<string, string>)[`name_${locale}`]) || location.name;
  const title = t.metaTitle(occT, locName);
  const description = t.metaDesc(occD, occT.toLowerCase(), locName);

  return {
    title,
    description,
    alternates: localeAlternates(`/locations/${slug}/${occasion}`, locale),
    openGraph: { title, description, url: `https://photoportugal.com/locations/${slug}/${occasion}` },
  };
}

export default async function OccasionPage({ params }: { params: Promise<{ locale: string; slug: string; occasion: string }> }) {
  const { locale, slug, occasion } = await params;
  setRequestLocale(locale);

  const location = getLocationBySlug(slug);
  const occ = OCCASIONS[occasion];
  if (!location || !occ) notFound();

  // Get photographers at this location that offer this shoot type
  let photographers: { slug: string; name: string; avatar_url: string | null; rating: number; review_count: number; starting_price: number | null }[] = [];
  try {
    photographers = await query<{ slug: string; name: string; avatar_url: string | null; rating: number; review_count: number; starting_price: number | null }>(
      `SELECT pp.slug, u.name, u.avatar_url, pp.rating, pp.review_count,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) as starting_price
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE AND pp.id IN (
         SELECT photographer_id FROM photographer_locations WHERE location_slug = $1
       )
       ORDER BY RANDOM() LIMIT 8`,
      [slug]
    );
  } catch {}

  // Aggregate stats for schema
  let avgRating = 0;
  let totalReviews = 0;
  try {
    const stats = await queryOne<{ avg_rating: string | null; total_reviews: string }>(
      `SELECT AVG(pp.rating) FILTER (WHERE pp.rating IS NOT NULL AND pp.review_count > 0) as avg_rating,
              COALESCE(SUM(pp.review_count), 0) as total_reviews
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       WHERE pl.location_slug = $1 AND pp.is_approved = TRUE`,
      [slug]
    );
    avgRating = stats?.avg_rating ? parseFloat(parseFloat(stats.avg_rating).toFixed(1)) : 0;
    totalReviews = parseInt(stats?.total_reviews || "0");
  } catch {}

  const nearby = getNearbyLocations(slug);
  const shootTypeData = shootTypes.find((st) => st.slug === occasion);

  const t = pickL(locale);
  const locName = ((location as unknown as Record<string, string>)[`name_${locale}`]) || location.name;
  const occT = occTitle(occ, locale);
  const occD = occDesc(occ, locale);
  const title = `${occT} ${t.inLocation} ${locName}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${occT} in ${locName}, Portugal`,
    description: occD,
    url: `https://photoportugal.com/locations/${slug}/${occasion}`,
    provider: {
      "@type": "Organization",
      name: "Photo Portugal",
      url: "https://photoportugal.com",
    },
    areaServed: {
      "@type": "City",
      name: location.name,
      containedInPlace: { "@type": "Country", name: "Portugal" },
    },
    ...(photographers.length > 0 && photographers[0].starting_price ? {
      offers: {
        "@type": "Offer",
        priceCurrency: "EUR",
        price: String(photographers[0].starting_price),
        availability: "https://schema.org/InStock",
      },
    } : {}),
    ...(totalReviews > 0 && avgRating > 0 ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: avgRating,
        reviewCount: totalReviews,
        bestRating: 5,
        worstRating: 1,
      },
    } : {}),
  };

  // FAQ schema from shoot type data
  const rawFaqs = shootTypeData?.faqs || [];
  const faqs = rawFaqs.map((f) => {
    const fl = f as unknown as Record<string, string | undefined>;
    return {
      question: fl[`question_${locale}`] || f.question,
      answer: fl[`answer_${locale}`] || f.answer,
    };
  });
  const jsonLdFaq = faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;

  const breadcrumbs = [
    { name: t.home, href: "/" },
    { name: t.locations, href: "/locations" },
    { name: locName, href: `/locations/${slug}` },
    { name: occT, href: `/locations/${slug}/${occasion}` },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {jsonLdFaq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      )}
      <Breadcrumbs items={breadcrumbs} />

      <div className="mt-6">
        <span className="text-4xl">{occ.emoji}</span>
        <h1 className="mt-2 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-lg text-gray-600 leading-relaxed max-w-2xl">
          {occD}
        </p>
      </div>

      {/* Photographers */}
      {photographers.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900">
            {t.availablePhotographers(locName)}
          </h2>
          <div className="mt-4">
            <ScarcityBanner count={photographers.length} locationName={locName} locale={locale} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {photographers.map((p) => (
              <Link
                key={p.slug}
                href={`/photographers/${p.slug}`}
                className="flex items-center gap-4 rounded-xl border border-warm-200 bg-white p-4 transition hover:shadow-md"
              >
                <Avatar src={p.avatar_url} fallback={normalizeName(p.name)} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{normalizeName(p.name)}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-sm text-gray-500">
                    {Number(p.rating) > 0 && <span className="text-amber-500">★ {Number(p.rating).toFixed(1)}</span>}
                    {p.review_count > 0 && <span>({p.review_count} {t.reviews})</span>}
                  </div>
                  {p.starting_price && (
                    <p className="mt-0.5 text-sm font-medium text-gray-700">
                      {t.from} &euro;{Math.round(Number(p.starting_price))}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* About this location — SEO-rich content */}
      {(((location as unknown as Record<string, string>)[`long_description_${locale}`]) || location.long_description) && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900">
            {t.aboutLocation(locName)}
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed">
            {((location as unknown as Record<string, string>)[`long_description_${locale}`]) || location.long_description}
          </p>
        </section>
      )}

      {/* Other occasions in this location */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-gray-900">
          {t.otherOccasions(locName)}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(OCCASIONS)
            .filter(([key]) => key !== occasion)
            .map(([key, occ]) => (
              <Link
                key={key}
                href={`/locations/${slug}/${key}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-warm-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
              >
                <span>{occ.emoji}</span>
                {occTitle(occ, locale)}
              </Link>
            ))}
        </div>
      </section>

      {/* Same occasion in nearby locations */}
      {nearby.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900">
            {t.nearbyTitle(occT)}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t.nearbySub(locName)}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {nearby.slice(0, 4).map((nb) => {
              const nbR = nb as unknown as Record<string, string | undefined>;
              const nbName = nbR[`name_${locale}`] || nb.name;
              const nbDesc = nbR[`description_${locale}`] || nb.description;
              return (
                <Link
                  key={nb.slug}
                  href={`/locations/${nb.slug}/${occasion}`}
                  className="group rounded-xl border border-warm-200 bg-white p-5 transition hover:border-primary-200 hover:shadow-md"
                >
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition">
                    {occT} {t.inLocation} {nbName}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {nbDesc}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                    {t.viewPhotographers} &rarr;
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* FAQ from shoot type data */}
      {faqs.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900">
            {t.faqTitle}
          </h2>
          <div className="mt-4 space-y-3">
            {faqs.slice(0, 4).map((faq, i) => (
              <details
                key={i}
                className="group rounded-xl border border-warm-200 bg-warm-50"
              >
                <summary className="flex items-center justify-between px-5 py-4 font-semibold text-gray-900 cursor-pointer text-sm">
                  {faq.question}
                  <svg
                    className="h-4 w-4 shrink-0 text-gray-400 transition group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-5 pb-4">
                  <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="mt-12 rounded-2xl bg-primary-50 p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-gray-900">
          {t.ctaTitle(occT.toLowerCase(), locName)}
        </h2>
        <p className="mt-2 text-gray-600">
          {t.ctaSub}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={`/photographers?location=${slug}`}
            className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {t.ctaBtn}
          </Link>
          <Link
            href={`/locations/${slug}`}
            className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-white"
          >
            {t.ctaSecondary}
          </Link>
        </div>
      </div>
    </div>
  );
}

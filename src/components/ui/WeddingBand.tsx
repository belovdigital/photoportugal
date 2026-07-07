import { Link } from "@/i18n/navigation";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { TrackedCTALink } from "@/components/ui/TrackedCTALink";
import { unsplashUrl, IMAGE_SIZES } from "@/lib/unsplash-images";
import { locations } from "@/lib/locations-data";

// Homepage band for the wedding funnel → /weddings landing. Dark and
// editorial on purpose: it sits between How-It-Works and the pastel
// gift-cards promo, so it needs contrast with both. Strings are inline
// per-locale (combo-page pattern) — nothing to forget in messages/*.json.

const WEDDING_DB_NAMES = ["Wedding"];

// Known-good Unsplash fallback (same id ShootTypesSection uses for the
// wedding tile) for when too few tagged photos exist yet.
const FALLBACK_IMG = "photo-1606216794079-73f85bbd57d5";

const QUICK_DESTINATIONS = ["sintra", "algarve", "douro-valley", "lisbon"];

const L: Record<string, {
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  photographersLabel: (n: number) => string;
  fromLabel: (p: number) => string;
  popularLabel: string;
}> = {
  en: {
    badge: "Weddings",
    title: "Getting married in Portugal?",
    subtitle: "Local wedding photographers who know every venue, viewpoint, and golden-hour spot — from intimate elopements to full-day celebrations.",
    cta: "Explore wedding photography",
    photographersLabel: (n) => `${n} wedding photographers`,
    fromLabel: (p) => `from €${p}`,
    popularLabel: "Popular:",
  },
  pt: {
    badge: "Casamentos",
    title: "Vão casar em Portugal?",
    subtitle: "Fotógrafos de casamento locais que conhecem cada espaço, miradouro e luz dourada — de elopements intimistas a celebrações de dia inteiro.",
    cta: "Explorar fotografia de casamento",
    photographersLabel: (n) => `${n} fotógrafos de casamento`,
    fromLabel: (p) => `a partir de €${p}`,
    popularLabel: "Populares:",
  },
  de: {
    badge: "Hochzeiten",
    title: "Ihr heiratet in Portugal?",
    subtitle: "Lokale Hochzeitsfotografen, die jede Location, jeden Aussichtspunkt und jeden Golden-Hour-Spot kennen — von intimen Elopements bis zur ganztägigen Begleitung.",
    cta: "Hochzeitsfotografie entdecken",
    photographersLabel: (n) => `${n} Hochzeitsfotografen`,
    fromLabel: (p) => `ab €${p}`,
    popularLabel: "Beliebt:",
  },
  es: {
    badge: "Bodas",
    title: "¿Os casáis en Portugal?",
    subtitle: "Fotógrafos de boda locales que conocen cada espacio, mirador y luz dorada — desde elopements íntimos hasta celebraciones de día completo.",
    cta: "Explorar fotografía de boda",
    photographersLabel: (n) => `${n} fotógrafos de boda`,
    fromLabel: (p) => `desde €${p}`,
    popularLabel: "Populares:",
  },
  fr: {
    badge: "Mariages",
    title: "Vous vous mariez au Portugal ?",
    subtitle: "Des photographes de mariage locaux qui connaissent chaque lieu, point de vue et lumière dorée — des elopements intimes aux célébrations d'une journée complète.",
    cta: "Découvrir la photographie de mariage",
    photographersLabel: (n) => `${n} photographes de mariage`,
    fromLabel: (p) => `à partir de €${p}`,
    popularLabel: "Populaires :",
  },
};

export async function WeddingBand({ locale }: { locale: string }) {
  const ll = L[locale] || L.en;

  let photographerCount = 0;
  let minPrice: number | null = null;
  let photos: string[] = [];
  try {
    const { query, queryOne } = await import("@/lib/db");
    const stats = await queryOne<{ count: string; min_price: string | null }>(
      `SELECT COUNT(DISTINCT pp.id) as count,
              (SELECT MIN(pk.price) FROM packages pk
               JOIN photographer_profiles pp2 ON pp2.id = pk.photographer_id
               WHERE pp2.is_approved = TRUE AND pk.is_public = TRUE
                 AND pp2.shoot_types && $1::text[]) as min_price
       FROM photographer_profiles pp
       WHERE pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND pp.shoot_types && $1::text[]`,
      [WEDDING_DB_NAMES]
    );
    photographerCount = parseInt(stats?.count || "0");
    minPrice = stats?.min_price ? parseFloat(stats.min_price) : null;

    const rows = await query<{ url: string }>(
      `SELECT pi.url
       FROM portfolio_items pi
       JOIN photographer_profiles pp ON pp.id = pi.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pi.type = 'photo'
         AND pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND pi.shoot_type = ANY($1::text[])
       ORDER BY -LN(RANDOM()) / (CASE
           WHEN pp.is_featured THEN 50
           WHEN pp.is_verified THEN 30
           ELSE 2
         END) ASC
       LIMIT 3`,
      [WEDDING_DB_NAMES]
    );
    photos = rows.map((r) => r.url);
  } catch {}

  const quickLinks = QUICK_DESTINATIONS.map((slug) => {
    const loc = locations.find((l) => l.slug === slug);
    if (!loc) return null;
    const locR = loc as unknown as Record<string, string | undefined>;
    return { slug, name: locR[`name_${locale}`] || loc.name };
  }).filter((l): l is { slug: string; name: string } => l !== null);

  return (
    <section className="relative overflow-hidden bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Copy + CTA */}
          <div>
            <span className="inline-block rounded-full bg-rose-500/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-300">
              💍 {ll.badge}
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
              {ll.title}
            </h2>
            <p className="mt-4 max-w-xl text-gray-300 leading-relaxed">
              {ll.subtitle}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
              {photographerCount > 0 && <span>{ll.photographersLabel(photographerCount)}</span>}
              {photographerCount > 0 && minPrice != null && <span aria-hidden>·</span>}
              {minPrice != null && <span>{ll.fromLabel(minPrice)}</span>}
            </div>
            <TrackedCTALink
              href="/weddings"
              ctaName="weddings_band"
              location="homepage"
              className="mt-7 inline-flex rounded-xl bg-rose-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-500"
            >
              {ll.cta}
            </TrackedCTALink>
            {quickLinks.length > 0 && (
              <p className="mt-5 text-sm text-gray-400">
                {ll.popularLabel}{" "}
                {quickLinks.map((l, i) => (
                  <span key={l.slug}>
                    <Link
                      href={`/locations/${l.slug}/wedding`}
                      className="font-medium text-gray-200 underline decoration-gray-600 underline-offset-4 transition hover:text-white hover:decoration-rose-400"
                    >
                      {l.name}
                    </Link>
                    {i < quickLinks.length - 1 && <span aria-hidden>, </span>}
                  </span>
                ))}
              </p>
            )}
          </div>

          {/* Photo collage — wedding-tagged work, Unsplash fallback */}
          <div className="relative hidden lg:block">
            {photos.length >= 3 ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="overflow-hidden rounded-2xl">
                  <OptimizedImage src={photos[0]} alt={ll.badge} className="aspect-[3/4] h-full w-full object-cover" />
                </div>
                <div className="mt-10 flex flex-col gap-4">
                  <div className="overflow-hidden rounded-2xl">
                    <OptimizedImage src={photos[1]} alt={ll.badge} className="aspect-[4/3] w-full object-cover" />
                  </div>
                  <div className="overflow-hidden rounded-2xl">
                    <OptimizedImage src={photos[2]} alt={ll.badge} className="aspect-[4/3] w-full object-cover" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl">
                <OptimizedImage
                  src={photos[0] || unsplashUrl(FALLBACK_IMG, IMAGE_SIZES.cardLarge)}
                  alt={ll.badge}
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

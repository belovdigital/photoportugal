import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { queryOne, query } from "@/lib/db";
import { getPresignedUrl, isS3Path, s3KeyFromPath } from "@/lib/s3";
import { maskSurname } from "@/lib/photographer-name";
import { normalizeName } from "@/lib/format-name";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

export const dynamic = "force-dynamic";

// ── Sneak peek — public, passwordless, shareable by design ─────────────
// Up to 10 CLEAN 1200px thumbnails (no watermark, no full-res, no
// download) shared by the photographer while editing the full gallery.
// Security model: 64-char unguessable token + noindex + auto-expiry (the
// link dies when the full delivery is accepted, or 30 days after the peek
// was shared). Photographer name is MASKED — viewers are the client's
// friends, i.e. a pre-payment audience (anti-disintermediation rule).

const PEEK_TTL_DAYS = 30;

interface PeekBooking {
  id: string;
  status: string;
  delivery_accepted: boolean;
  peek_shared_at: string;
  shoot_date: string | null;
  location_slug: string | null;
  occasion: string | null;
  delivery_days: number | null;
  num_photos: number | null;
  photographer_name: string;
  photographer_avatar: string | null;
  photographer_slug: string;
}

async function getPeek(token: string): Promise<{ booking: PeekBooking; photos: { id: string; src: string }[] } | { expired: true } | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const booking = await queryOne<PeekBooking>(
    `SELECT b.id, b.status, COALESCE(b.delivery_accepted, FALSE) as delivery_accepted,
            b.peek_shared_at::text as peek_shared_at, b.shoot_date::text as shoot_date,
            b.location_slug, b.occasion, p.delivery_days, p.num_photos,
            u.name as photographer_name, u.avatar_url as photographer_avatar, pp.slug as photographer_slug
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     LEFT JOIN packages p ON p.id = b.package_id
     WHERE b.peek_token = $1`,
    [token]
  );
  if (!booking || !booking.peek_shared_at) return null;
  const ageMs = Date.now() - new Date(booking.peek_shared_at).getTime();
  if (booking.delivery_accepted || ageMs > PEEK_TTL_DAYS * 86400000 || booking.status === "cancelled") {
    return { expired: true };
  }
  const raw = await query<{ id: string; thumbnail_url: string | null; preview_url: string | null }>(
    `SELECT id, thumbnail_url, preview_url FROM delivery_photos
      WHERE booking_id = $1 AND is_peek = TRUE AND COALESCE(media_type, 'image') <> 'video'
      ORDER BY sort_order, created_at LIMIT 10`,
    [booking.id]
  );
  const photos = (await Promise.all(raw.map(async (p) => {
    // Clean 1200px thumbnail only — never the original. Watermarked
    // preview is the legacy fallback for rows without a thumbnail.
    let src = p.thumbnail_url || p.preview_url;
    if (!src) return null;
    if (isS3Path(src)) src = await getPresignedUrl(s3KeyFromPath(src), 3600);
    return { id: p.id, src };
  }))).filter(Boolean) as { id: string; src: string }[];
  if (photos.length === 0) return { expired: true };
  return { booking, photos };
}

export async function generateMetadata({ params }: { params: Promise<{ token: string; locale: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await getPeek(token);
  if (!data || "expired" in data) {
    return { title: "Sneak peek | Photo Portugal", robots: { index: false, follow: false } };
  }
  const loc = data.booking.location_slug ? data.booking.location_slug.replace(/-/g, " ") : "Portugal";
  const occ = data.booking.occasion ? `${data.booking.occasion} ` : "";
  // og:image presigned for 6 days — link-preview scrapers fetch at share
  // time, well inside the window.
  let og = data.photos[0]?.src || "/og-image.png";
  try {
    const raw = await queryOne<{ thumbnail_url: string | null }>(
      "SELECT thumbnail_url FROM delivery_photos WHERE booking_id = $1 AND is_peek = TRUE ORDER BY sort_order, created_at LIMIT 1",
      [data.booking.id]
    );
    if (raw?.thumbnail_url && isS3Path(raw.thumbnail_url)) {
      og = await getPresignedUrl(s3KeyFromPath(raw.thumbnail_url), 6 * 86400);
    }
  } catch {}
  return {
    title: `Sneak peek — ${occ}photoshoot in ${loc} | Photo Portugal`,
    robots: { index: false, follow: false },
    openGraph: {
      title: `✨ Sneak peek — ${occ}photoshoot in ${loc}`,
      description: "A first look from a Photo Portugal session.",
      images: [{ url: og, width: 1200, height: 800 }],
    },
  };
}

export default async function PeekPage({ params }: { params: Promise<{ token: string; locale: string }> }) {
  const { token, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("peek");
  const data = await getPeek(token);

  if (!data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="text-4xl">🔍</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-gray-900">{t("notFoundTitle")}</h1>
        <p className="mt-2 text-gray-500">{t("notFoundSub")}</p>
      </div>
    );
  }
  if ("expired" in data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="text-4xl">✨</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-gray-900">{t("expiredTitle")}</h1>
        <p className="mt-2 text-gray-500">{t("expiredSub")}</p>
        <a href="/photographers" className="mt-6 inline-block rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white hover:bg-primary-700">
          {t("expiredCta")}
        </a>
      </div>
    );
  }

  const { booking, photos } = data;
  const visibleName = normalizeName(maskSurname(booking.photographer_name));
  const expected = booking.shoot_date
    ? new Date(new Date(booking.shoot_date).getTime() + (booking.delivery_days || 7) * 86400000)
    : null;
  const intl = ({ pt: "pt-PT", de: "de-DE", es: "es-ES", fr: "fr-FR" } as Record<string, string>)[locale] || "en-GB";
  const expectedStr = expected ? expected.toLocaleDateString(intl, { day: "numeric", month: "long" }) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      {/* Header — photographer identity (masked) + expectation setting */}
      <div className="text-center">
        {booking.photographer_avatar ? (
          <OptimizedImage src={booking.photographer_avatar} alt={visibleName} width={200} className="mx-auto h-16 w-16 rounded-full object-cover ring-4 ring-warm-100" />
        ) : (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-2xl">✨</div>
        )}
        <h1 className="mt-4 font-display text-2xl font-bold text-gray-900 sm:text-3xl">
          {t("title", { name: visibleName })}
        </h1>
        <p className="mt-2 text-gray-500">
          {t("subtitle", { name: visibleName.split(" ")[0], count: photos.length })}
        </p>
        {expectedStr && (
          <p className="mx-auto mt-4 w-fit rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-800">
            {t("fullGalleryExpected", { count: booking.num_photos || 0, date: expectedStr })}
          </p>
        )}
      </div>

      {/* Photos — clean 1200px thumbnails, view-only */}
      <div className="mt-10 columns-1 gap-4 sm:columns-2 [&>*]:mb-4">
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.src} alt="" loading="lazy" className="w-full break-inside-avoid rounded-2xl shadow-sm" />
        ))}
      </div>

      {/* Footer — credit (masked, links to profile) + soft acquisition CTA
          for the friends this link gets forwarded to. */}
      <div className="mt-12 border-t border-warm-100 pt-8 text-center">
        <p className="text-sm text-gray-500">
          {t("photosBy")}{" "}
          <a href={`/photographers/${booking.photographer_slug}`} className="font-semibold text-primary-600 hover:underline">
            {visibleName}
          </a>
        </p>
        <a
          href="/photographers"
          className="mt-4 inline-block rounded-xl border border-primary-200 bg-primary-50 px-6 py-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-100"
        >
          {t("bookYourOwn")}
        </a>
        <p className="mt-6 text-xs text-gray-400">
          {t("deliveredVia")} <a href="https://photoportugal.com" className="text-primary-600 hover:underline">Photo Portugal</a>
        </p>
      </div>
    </div>
  );
}

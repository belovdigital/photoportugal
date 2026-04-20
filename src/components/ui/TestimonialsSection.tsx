import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { query } from "@/lib/db";
import { formatPublicName } from "@/lib/format-name";

interface HomepageReview {
  id: string;
  text: string;
  rating: number;
  client_name: string | null;
  photographer_name: string;
  photographer_slug: string;
  photographer_avatar: string | null;
  photo_url: string | null;
}

async function fetchHomepageReviews(): Promise<HomepageReview[]> {
  try {
    const rows = await query<{
      id: string;
      text: string;
      rating: number;
      client_name_override: string | null;
      client_db_name: string | null;
      photographer_name: string;
      photographer_slug: string;
      photographer_avatar: string | null;
      photo_url: string | null;
    }>(
      `WITH ranked AS (
         SELECT r.id, r.text, r.rating, r.created_at,
                r.client_name_override,
                cu.name as client_db_name,
                pu.name as photographer_name,
                pp.slug as photographer_slug,
                pu.avatar_url as photographer_avatar,
                (SELECT rp.url FROM review_photos rp WHERE rp.review_id = r.id AND rp.is_public = TRUE ORDER BY rp.created_at LIMIT 1) as photo_url,
                ROW_NUMBER() OVER (PARTITION BY r.photographer_id ORDER BY LENGTH(COALESCE(r.text, '')) DESC) as rn_per_photographer
         FROM reviews r
         JOIN photographer_profiles pp ON pp.id = r.photographer_id
         JOIN users pu ON pu.id = pp.user_id
         LEFT JOIN users cu ON cu.id = r.client_id
         WHERE r.is_approved = TRUE AND r.text IS NOT NULL AND LENGTH(r.text) >= 80
           AND pp.is_approved = TRUE
       )
       SELECT id, text, rating, client_name_override, client_db_name, photographer_name, photographer_slug, photographer_avatar, photo_url
       FROM ranked
       WHERE rn_per_photographer <= 2
       ORDER BY photo_url IS NULL, LENGTH(text) DESC
       LIMIT 9`
    );

    return rows.map((r) => ({
      id: r.id,
      text: r.text,
      rating: r.rating,
      client_name: r.client_name_override || r.client_db_name || null,
      photographer_name: r.photographer_name,
      photographer_slug: r.photographer_slug,
      photographer_avatar: r.photographer_avatar,
      photo_url: r.photo_url,
    }));
  } catch {
    return [];
  }
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max).split(" ").slice(0, -1).join(" ");
  return cut + "…";
}

export async function TestimonialsSection() {
  const t = await getTranslations("testimonials");
  const td = await getTranslations("dashboard");
  const reviews = await fetchHomepageReviews();

  if (reviews.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="inline-block rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-yellow-800">
            {t("badge")}
          </span>
          <h2 className="mt-3 font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("title")}
          </h2>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span><strong className="text-gray-900">5.0</strong> {t("averageRating")}</span>
          <span className="text-warm-300">&bull;</span>
          <span>{t("allReviewsVerified")}</span>
        </div>
      </div>

      <div className="mt-6 -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory sm:mx-0 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
        {reviews.map((r) => {
          const displayName = r.client_name ? formatPublicName(r.client_name) : td("privateClient");
          return (
            <Link
              key={r.id}
              href={`/photographers/${r.photographer_slug}`}
              className="flex shrink-0 w-[85%] snap-start flex-col rounded-2xl border border-warm-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:w-auto"
            >
              {r.photo_url && (
                <div className="mb-3 -mx-1 overflow-hidden rounded-xl">
                  <img src={r.photo_url} alt={`Client review photo — ${r.photographer_name}`} className="h-40 w-full object-cover" loading="lazy" />
                </div>
              )}
              <Stars count={r.rating} />
              <p className="mt-2 text-sm leading-relaxed text-gray-700 line-clamp-5">
                {truncate(r.text, 240)}
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-warm-100 pt-3">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-primary-100">
                  {r.photographer_avatar ? (
                    <img src={r.photographer_avatar} alt={r.photographer_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary-600">
                      {r.photographer_name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${r.client_name ? "text-gray-900" : "text-gray-500 italic"}`}>
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {t("aboutPhotographer", { name: r.photographer_name })}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/photographers"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          {t("browseAll")}
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

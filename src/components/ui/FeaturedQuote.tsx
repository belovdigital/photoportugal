import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { formatPublicName } from "@/lib/format-name";
import type { PublicReview } from "@/lib/reviews-data";

export async function FeaturedQuote({ review, invert = false }: { review: PublicReview; invert?: boolean }) {
  const tc = await getTranslations("common");
  const displayName = review.client_name ? formatPublicName(review.client_name) : tc("privateClient");
  const textCls = invert ? "text-white/95" : "text-gray-800";
  const nameCls = invert
    ? (review.client_name ? "text-white" : "text-white/60 italic")
    : (review.client_name ? "text-gray-900" : "text-gray-500 italic");
  const aboutCls = invert ? "text-white/60" : "text-gray-500";
  const linkCls = invert ? "text-white underline hover:text-white/80" : "text-primary-600 hover:underline";

  return (
    <figure className="mx-auto max-w-3xl text-center">
      <div className={`flex justify-center gap-1 ${invert ? "opacity-90" : ""}`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <blockquote className={`mt-4 font-display text-xl italic leading-snug sm:text-2xl ${textCls}`}>
        &ldquo;{review.text.length > 280 ? review.text.slice(0, 280).replace(/\s\S*$/, "") + "…" : review.text}&rdquo;
      </blockquote>
      <figcaption className={`mt-4 text-sm ${aboutCls}`}>
        <span className={`font-semibold not-italic ${nameCls}`}>{displayName}</span>
        <span> — {tc("featuredQuoteAbout")} </span>
        <Link href={`/photographers/${review.photographer_slug}`} className={linkCls}>
          {review.photographer_name}
        </Link>
      </figcaption>
    </figure>
  );
}

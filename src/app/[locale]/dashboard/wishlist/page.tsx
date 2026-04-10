"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { WishlistButton } from "@/components/ui/WishlistButton";
import { normalizeName } from "@/lib/format-name";

interface WishlistItem {
  photographer_id: string;
  slug: string;
  name: string;
  tagline: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  rating: number;
  review_count: number;
  min_price: number | null;
  wishlisted_at: string;
}

export default function WishlistPage() {
  const t = useTranslations("common");
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/wishlist")
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleRemoved = (id: string) => {
    setItems((prev) => prev.filter((i) => i.photographer_id !== id));
  };

  if (loading) {
    return (
      <div className="p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-gray-900">{t("savedPhotographers")}</h1>
        <div className="mt-6 flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">{t("savedPhotographers")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("photographersSaved", { count: items.length })}</p>

      {items.length === 0 ? (
        <div className="mt-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <p className="mt-4 text-gray-500">{t("noSavedPhotographers")}</p>
          <p className="mt-1 text-sm text-gray-400">{t("noSavedPhotographersHint")}</p>
          <Link href="/photographers" className="mt-6 inline-block rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition">
            Browse Photographers
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.photographer_id} className="group relative overflow-hidden rounded-xl border border-warm-200 bg-white transition hover:shadow-md">
              {/* Cover */}
              <div className="relative h-32 bg-gradient-to-br from-primary-300 to-primary-600">
                {item.cover_url && (
                  <OptimizedImage src={item.cover_url} alt="" width={600} quality={80} className="h-full w-full" />
                )}
                <div className="absolute right-3 top-3">
                  <WishlistButton
                    photographerId={item.photographer_id}
                    size="sm"
                    className="shadow-sm"
                    onToggle={(wishlisted) => { if (!wishlisted) handleRemoved(item.photographer_id); }}
                  />
                </div>
              </div>

              {/* Avatar overlapping cover */}
              <div className="px-4 -mt-6 relative z-10">
                <div className="h-12 w-12 rounded-full border-3 border-white bg-primary-100 shadow-md overflow-hidden">
                  <Avatar src={item.avatar_url} fallback={item.name} size="md" />
                </div>
              </div>

              <Link href={`/photographers/${item.slug}`} className="block px-4 pt-2 pb-4">
                <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary-600 transition">{normalizeName(item.name)}</h3>
                {item.tagline && <p className="text-sm text-gray-500 truncate mt-0.5">{item.tagline}</p>}

                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.review_count > 0 && (
                      <>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <svg key={i} className={`h-3.5 w-3.5 ${i < Math.round(item.rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">({item.review_count})</span>
                      </>
                    )}
                  </div>
                  {item.min_price && (
                    <span className="text-sm">
                      <span className="text-gray-400">{t("from")} </span>
                      <span className="font-bold text-gray-900">&euro;{Math.round(item.min_price)}</span>
                    </span>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

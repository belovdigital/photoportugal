"use client";

import { useState } from "react";
import Link from "next/link";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  text: string | null;
  is_verified: boolean;
  created_at: string;
  client_name: string;
  client_avatar: string | null;
}

const PAGE_SIZE = 5;

export function ReviewsPaginated({
  reviews,
  reviewCount,
  rating,
  photographerName,
  photographerSlug,
}: {
  reviews: Review[];
  reviewCount: number;
  rating: number;
  photographerName: string;
  photographerSlug: string;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  const shown = reviews.slice(0, visible);
  const hasMore = visible < reviews.length;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          Reviews ({reviewCount})
        </h2>
        {rating > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">{rating}</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className={`h-5 w-5 ${i < Math.round(rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {shown.map((review) => (
          <div key={review.id} className="rounded-xl border border-warm-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
                  {review.client_name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{review.client_name}</p>
                  <p className="text-xs text-gray-400">
                    Review for{" "}
                    <Link href={`/photographers/${photographerSlug}`} className="text-primary-600 hover:underline">{photographerName}</Link>
                    {" "}&middot;{" "}
                    {new Date(review.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
              {review.is_verified && (
                <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-700">Verified Booking</span>
              )}
            </div>
            <div className="mt-3 flex gap-0.5">
              {Array.from({ length: review.rating }).map((_, i) => (
                <svg key={i} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            {review.title && <h4 className="mt-2 font-semibold text-gray-900">{review.title}</h4>}
            {review.text && <p className="mt-2 text-sm text-gray-600 leading-relaxed">{review.text}</p>}
          </div>
        ))}

        {reviews.length === 0 && (
          <p className="text-gray-400">No reviews yet.</p>
        )}

        {hasMore && (
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="w-full rounded-xl border border-warm-200 py-3 text-sm font-semibold text-gray-600 transition hover:bg-warm-50"
          >
            Show more reviews ({reviews.length - visible} remaining)
          </button>
        )}
      </div>
    </section>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

export function FloatingReviews() {
  const t = useTranslations("home");
  const reviews = t.raw("floatingReviews") as { text: string; author: string; location: string }[];
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % reviews.length);
        setVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, [reviews.length]);

  const review = reviews[index];

  return (
    <div
      className={`absolute -left-6 bottom-8 rounded-xl border border-warm-200 bg-white p-4 shadow-lg transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"}`}
      style={{ maxWidth: "240px" }}
    >
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <svg key={i} className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <span className="text-xs font-semibold text-gray-900">5.0</span>
      </div>
      <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">
        &ldquo;{review.text}&rdquo;
      </p>
      <p className="mt-1 text-[11px] text-gray-400">{review.author} &middot; {review.location}</p>
    </div>
  );
}

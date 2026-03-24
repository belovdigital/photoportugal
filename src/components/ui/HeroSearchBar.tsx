"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface LocationOption {
  slug: string;
  name: string;
}

export function HeroSearchBar({ locations }: { locations: LocationOption[] }) {
  const router = useRouter();
  const t = useTranslations("heroSearch");
  const [selected, setSelected] = useState("");

  function handleSearch() {
    if (selected) {
      router.push(`/photographers?location=${selected}`);
    } else {
      router.push("/photographers");
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-lg transition-shadow focus-within:shadow-xl focus-within:border-primary-300">
        <div className="flex flex-1 items-center gap-3 px-5 py-4">
          <svg
            className="h-5 w-5 shrink-0 text-primary-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label={t("placeholder")}
            className="w-full appearance-none bg-transparent text-gray-700 outline-none text-base"
          >
            <option value="">{t("placeholder")}</option>
            {locations.map((loc) => (
              <option key={loc.slug} value={loc.slug}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSearch}
          aria-label={t("search")}
          className="flex items-center gap-2 bg-primary-600 px-6 sm:px-8 font-semibold text-white transition hover:bg-primary-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="hidden sm:inline">{t("search")}</span>
        </button>
      </div>
    </div>
  );
}

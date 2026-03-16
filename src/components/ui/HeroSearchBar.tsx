"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LocationOption {
  slug: string;
  name: string;
}

export function HeroSearchBar({ locations }: { locations: LocationOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState("");

  function handleSearch() {
    if (selected) {
      router.push(`/photographers?location=${selected}`);
    } else {
      router.push("/photographers");
    }
  }

  return (
    <div className="mt-12 max-w-2xl">
      <div className="flex overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-1 items-center gap-3 px-6 py-4">
          <svg
            className="h-5 w-5 shrink-0 text-gray-400"
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
            className="w-full appearance-none bg-transparent text-gray-700 outline-none text-base"
          >
            <option value="">Where in Portugal?</option>
            {locations.map((loc) => (
              <option key={loc.slug} value={loc.slug}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSearch}
          className="flex items-center bg-primary-600 px-8 font-semibold text-white transition hover:bg-primary-700"
        >
          Search
        </button>
      </div>
    </div>
  );
}

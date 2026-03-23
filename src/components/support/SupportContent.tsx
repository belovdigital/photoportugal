"use client";

import { useState, useRef, useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Article {
  id: string;
  question: string;
  answer: string;
}

interface Category {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  articles: Article[];
}

interface SupportContentProps {
  categories: Category[];
  searchPlaceholder: string;
  searchNoResults: string;
  onThisPage: string;
}

/* ------------------------------------------------------------------ */
/*  Markdown-like answer rendering helpers                            */
/* ------------------------------------------------------------------ */

function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-gray-900">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

function renderAnswer(text: string) {
  return text.split("\n\n").map((paragraph, i) => (
    <p key={i} className={i > 0 ? "mt-3" : ""}>
      {paragraph.split("\n").map((line, j) => (
        <span key={j}>
          {j > 0 && <br />}
          {renderBold(line)}
        </span>
      ))}
    </p>
  ));
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function SupportContent({
  categories,
  searchPlaceholder,
  searchNoResults,
  onThisPage,
}: SupportContentProps) {
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState(categories[0]?.id ?? "");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const normalizedQuery = query.toLowerCase().trim();

  /* Filter categories & articles by search query */
  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      articles: cat.articles.filter(
        (a) =>
          !normalizedQuery ||
          a.question.toLowerCase().includes(normalizedQuery) ||
          a.answer.toLowerCase().includes(normalizedQuery)
      ),
    }))
    .filter((cat) => cat.articles.length > 0);

  /* Intersection observer for sticky nav highlighting */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    for (const ref of Object.values(sectionRefs.current)) {
      if (ref) observer.observe(ref);
    }

    return () => observer.disconnect();
  }, [filteredCategories]);

  const scrollTo = (id: string) => {
    const el = sectionRefs.current[id] ?? document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const totalResults = filteredCategories.reduce(
    (sum, c) => sum + c.articles.length,
    0
  );

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* -------- Mobile search bar (visible only on small screens) -------- */}
      <div className="mx-auto mb-8 max-w-2xl lg:hidden">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-warm-200 bg-white py-3 pl-12 pr-4 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>

      {/* -------- Main layout: sidebar + content -------- */}
      <div className="lg:grid lg:grid-cols-[288px_1fr] lg:gap-12">
        {/* Sidebar (desktop only) */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24">
            {/* Search input inside sidebar */}
            <div className="relative mb-5">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-warm-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>

            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {onThisPage}
            </p>
            <ul className="space-y-1">
              {filteredCategories.map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => scrollTo(cat.id)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      activeSection === cat.id
                        ? "bg-primary-50 font-semibold text-primary-700"
                        : "text-gray-600 hover:bg-warm-100 hover:text-gray-900"
                    }`}
                  >
                    {cat.title}
                  </button>
                  <ul className="ml-4 mt-1 space-y-0.5">
                    {cat.articles.map((article) => (
                      <li key={article.id}>
                        <button
                          onClick={() => scrollTo(article.id)}
                          className="block w-full whitespace-normal break-words rounded px-2 py-1 text-left text-xs text-gray-500 transition hover:text-primary-600"
                        >
                          {article.question}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0">
          {totalResults === 0 && (
            <div className="rounded-xl border border-warm-200 bg-white px-8 py-16 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="mt-4 text-gray-500">{searchNoResults}</p>
            </div>
          )}

          {filteredCategories.map((cat) => (
            <section
              key={cat.id}
              id={cat.id}
              ref={(el) => {
                sectionRefs.current[cat.id] = el;
              }}
              className="mb-14 scroll-mt-24"
            >
              {/* Section header */}
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                  {cat.icon}
                </span>
                <div>
                  <h2 className="font-display text-2xl font-bold text-gray-900">
                    {cat.title}
                  </h2>
                  <p className="text-sm text-gray-500">{cat.description}</p>
                </div>
              </div>

              {/* Articles */}
              <div className="space-y-3">
                {cat.articles.map((article) => (
                  <details
                    key={article.id}
                    id={article.id}
                    className="group scroll-mt-24 rounded-xl border border-warm-200 bg-white transition-shadow open:shadow-sm"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                      {article.question}
                      <svg
                        className="h-5 w-5 shrink-0 text-gray-400 transition group-open:rotate-180"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </summary>
                    <div className="border-t border-warm-100 px-6 py-5 leading-relaxed text-gray-600">
                      {renderAnswer(article.answer)}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

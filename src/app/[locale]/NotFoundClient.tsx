"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

// Logs the 404 hit (fire-and-forget) AND fetches a suggested redirect
// from the same endpoint in one round trip. Server replies with
// { suggestion: "/photographers/<slug>" } when pg_trgm finds a close
// slug match. Logging always happens; suggestion is best-effort.
export function NotFoundClient() {
  const t = useTranslations("notFound");
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname || "";
    if (!path || path === "/") return;

    fetch("/api/not-found-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.suggestion) setSuggestion(d.suggestion);
      })
      .catch(() => {});
  }, []);

  if (!suggestion) return null;

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">{t("didYouMean")}</p>
      <Link
        href={suggestion}
        className="mt-1 inline-block text-base font-semibold text-amber-900 hover:underline"
      >
        {suggestion}
      </Link>
    </div>
  );
}

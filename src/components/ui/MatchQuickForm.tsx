"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { LocationTreeOptions, getLocationTreeLabel } from "@/components/ui/LocationTreeOptions";

// Reusable inline match CTA — minimal 2-3 field form.
// Props:
//   presetLocation: skip the location picker (already known from the page, e.g. /locations/lisbon)
//   presetShootType: attach a shoot_type (e.g. from /photoshoots/couples) to the submission
//   source: analytics tag identifying where the form lives ("homepage_hero", "lp_lisbon", etc.)
//   variant: "light" (default, for light backgrounds) | "dark" (for dark hero sections / LP hero)
//   size: "md" (default) | "lg" (bigger, for hero placements)
export function MatchQuickForm({
  presetLocation,
  presetShootType,
  source,
  variant = "light",
  size = "md",
  heading,
  subheading,
}: {
  presetLocation?: string;
  presetShootType?: string;
  source: string;
  variant?: "light" | "dark";
  size?: "md" | "lg";
  heading?: string;
  subheading?: string;
}) {
  const t = useTranslations("quickMatch");
  const tc = useTranslations("photographers");
  const [email, setEmail] = useState("");
  const [locationSlug, setLocationSlug] = useState(presetLocation || "");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [locOpen, setLocOpen] = useState(false);
  const [locSearch, setLocSearch] = useState("");
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const selectedLocationName = locationSlug ? getLocationTreeLabel(locationSlug) : "";

  // Position dropdown below the button in viewport coords — survives any ancestor overflow:hidden.
  const openDropdown = () => {
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 240) });
    }
    setLocOpen(true);
  };

  // Close dropdown when clicking outside, reposition on scroll/resize
  useEffect(() => {
    if (!locOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setLocOpen(false);
      }
    };
    const reposition = () => {
      if (buttonRef.current) {
        const r = buttonRef.current.getBoundingClientRect();
        setDropdownPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 240) });
      }
    };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [locOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (!email.trim() || !locationSlug) {
      setErrorMsg(t("pleaseFillBoth"));
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/match-request/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          location_slug: locationSlug,
          shoot_type: presetShootType || undefined,
          source,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.error || t("errorGeneric"));
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setErrorMsg(t("errorGeneric"));
      setStatus("error");
    }
  }

  const darkMode = variant === "dark";
  const inputSize = size === "lg" ? "h-14 px-4 text-base" : "h-12 px-3.5 text-sm";
  const btnSize = size === "lg" ? "h-14 px-6 text-base" : "h-12 px-5 text-sm";

  // Inputs need to invert their entire skin when the form sits inside a
  // dark glass panel — bg + text + placeholder. Without this the dark
  // hero showed white text on white/95 fields, which was invisible.
  const inputCls = `rounded-xl border ${inputSize} outline-none focus:ring-2 ${
    darkMode
      ? "bg-white/15 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/20"
      : "bg-white/95 border-warm-300 text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:ring-primary-100"
  }`;

  if (status === "sent") {
    return (
      <div className={`rounded-2xl p-5 ${darkMode ? "bg-white/10 backdrop-blur border border-white/20" : "bg-accent-50 border border-accent-200"} max-w-xl`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${darkMode ? "bg-white/20" : "bg-accent-100"}`}>
            <svg className={`h-5 w-5 ${darkMode ? "text-white" : "text-accent-700"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className={`font-semibold ${darkMode ? "text-white" : "text-accent-800"}`}>{t("successTitle")}</p>
            <p className={`mt-0.5 text-sm ${darkMode ? "text-white/80" : "text-accent-700"}`}>{t("successBody")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      {heading && (
        <h3 className={`font-display text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"} ${subheading ? "mb-1" : "mb-3"}`}>
          {heading}
        </h3>
      )}
      {subheading && <p className={`mb-3 text-sm ${darkMode ? "text-white/80" : "text-gray-500"}`}>{subheading}</p>}

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-stretch">
        {!presetLocation && (
          <div className="w-full md:w-44">
            <button
              ref={buttonRef}
              type="button"
              onClick={() => locOpen ? setLocOpen(false) : openDropdown()}
              aria-label={t("locationLabel")}
              aria-expanded={locOpen}
              className={`${inputCls} flex w-full items-center justify-between gap-2 text-left ${
                locationSlug
                  ? (darkMode ? "text-white" : "text-gray-900")
                  : (darkMode ? "text-white/60" : "text-gray-400")
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <svg className="h-4 w-4 shrink-0 text-primary-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>
                <span className="truncate">{selectedLocationName || t("locationPlaceholder")}</span>
              </span>
              <svg className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition ${locOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {/* Portal renders dropdown at document.body so ancestor overflow:hidden doesn't clip it. */}
            {mounted && locOpen && dropdownPos && createPortal(
              <div
                ref={dropdownRef}
                className="fixed z-[200] rounded-xl border border-warm-200 bg-white shadow-xl"
                style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
              >
                {/* Search hidden on mobile — sm-and-below input fields with text < 16px trigger iOS auto-zoom and break the layout. Mobile gets the full dropdown without filter. */}
                <div className="hidden sm:block p-2">
                  <input
                    type="text"
                    value={locSearch}
                    onChange={(e) => setLocSearch(e.target.value)}
                    placeholder={tc("filters.searchLocations")}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary-400"
                    autoFocus
                  />
                </div>
                <div className="max-h-72 sm:max-h-60 overflow-y-auto px-1 py-1 sm:pb-1">
                  <LocationTreeOptions
                    selectedSlugs={locationSlug ? [locationSlug] : []}
                    onSelect={(slug) => { setLocationSlug(slug); setLocOpen(false); setLocSearch(""); }}
                    searchQuery={locSearch}
                    noMatchLabel={tc("noMatch")}
                  />
                </div>
              </div>,
              document.body
            )}
          </div>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          // Cap the email field at ~280px on desktop. Real email
          // addresses comfortably fit in 30 chars; without a cap the
          // input stretched the full row, looking absurdly wide on
          // location-page heros where the location dropdown is preset.
          className={`${inputCls} w-full md:flex-1 md:min-w-[180px] md:max-w-[280px]`}
          required
          aria-label={t("emailLabel")}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={`rounded-xl bg-primary-600 font-bold text-white shadow-lg transition hover:bg-primary-700 disabled:opacity-50 ${btnSize} w-full md:w-auto`}
        >
          {status === "loading" ? t("sending") : t("matchMe")}
        </button>
      </div>

      {errorMsg && (
        <p className={`mt-2 text-xs ${darkMode ? "text-red-200" : "text-red-600"}`}>{errorMsg}</p>
      )}
      <p className={`mt-2 text-xs ${darkMode ? "text-white/60" : "text-gray-400"}`}>{t("footnote")}</p>
    </form>
  );
}

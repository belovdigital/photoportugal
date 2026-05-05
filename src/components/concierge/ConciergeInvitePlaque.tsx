"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useConciergeDrawer } from "@/components/concierge/ConciergeDrawer";

/**
 * Glass plaque that invites the visitor into the AI concierge drawer.
 * Replaces the legacy MatchQuickForm (email capture → never-answered
 * leads) on the homepage hero, location pages, occasion pages, etc.
 *
 * Layout (top → bottom):
 *   ✨ Lens · AI · usually replies in seconds       <- mini bot header
 *   [chip] [chip] [chip]                            <- optional pre-prompt chips
 *   [_____ free-text _____] [→]                     <- input + submit
 *
 * Both chip clicks and the form submit do the same thing: open the drawer
 * with the selected/typed text as the visitor's first user message. The
 * drawer auto-sends it; the bot replies in <2 s.
 *
 * Variants:
 *   - dark (default): translucent white-on-glass over hero imagery
 *   - light: gray-on-white for white-background sections
 */
export function ConciergeInvitePlaque({
  placeholder,
  chips,
  variant = "dark",
  ctaLabel,
}: {
  placeholder: string;
  /** 0–4 short pre-prompt chips. Each renders as a button; click sends
   *  the chip text as the visitor's first message. */
  chips?: string[];
  variant?: "dark" | "light";
  ctaLabel?: string;
}) {
  const t = useTranslations("concierge.plaque");
  const drawer = useConciergeDrawer();
  const [text, setText] = useState("");

  function handleSend(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;
    drawer.openWith(trimmed);
    setText("");
  }

  const isDark = variant === "dark";

  // Container glass effect — thicker blur + ring on dark, plain card on light
  const containerCls = isDark
    ? "rounded-2xl border border-white/20 bg-white/10 p-4 shadow-xl backdrop-blur-md sm:p-5"
    : "rounded-2xl border border-warm-200 bg-white p-4 shadow-md sm:p-5";

  const headerCls = isDark
    ? "flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-white/85"
    : "flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-gray-600";

  const lensDotCls = isDark
    ? "flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[12px] shadow-sm ring-1 ring-white/30"
    : "flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[12px] shadow-sm";

  const chipCls = isDark
    ? "rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/95 backdrop-blur-sm transition hover:border-white/50 hover:bg-white/20"
    : "rounded-full border border-warm-200 bg-warm-50 px-3 py-1.5 text-[12px] font-medium text-gray-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700";

  const inputCls = isDark
    ? "flex-1 min-w-0 rounded-xl border border-white/20 bg-white/15 px-4 py-3 text-base text-white placeholder-white/60 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/30 sm:text-[15px]"
    : "flex-1 min-w-0 rounded-xl border border-warm-200 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 sm:text-[15px]";

  // Online-pulse dot — green for "Lens is online"
  const pulseCls = isDark ? "bg-emerald-400" : "bg-emerald-500";

  return (
    <div className={containerCls}>
      {/* Lens header — sets the expectation: "this is an AI you talk to" */}
      <div className={headerCls}>
        <span className={lensDotCls} aria-hidden>
          ✨
        </span>
        <span className="font-semibold">{t("lensName")}</span>
        <span aria-hidden className="opacity-50">·</span>
        <span className="flex items-center gap-1">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${pulseCls}`} aria-hidden />
          {t("tagline")}
        </span>
      </div>

      {/* Chip row — optional. Auto-sends on click. */}
      {chips && chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.slice(0, 4).map((chip, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(chip)}
              className={chipCls}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Free-text input + submit. The whole form lives inside the plaque. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(text);
        }}
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className={inputCls}
          aria-label={t("inputLabel")}
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-5 py-3 text-base font-bold text-white shadow-lg transition hover:bg-primary-700 sm:px-6"
        >
          {ctaLabel || t("send")}
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9-7-9-7M3 12h17" />
          </svg>
        </button>
      </form>
    </div>
  );
}

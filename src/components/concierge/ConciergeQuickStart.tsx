"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useConciergeDrawer } from "@/components/concierge/ConciergeDrawer";

/**
 * Compact "tell us what you want" form rendered in the location-page hero.
 * Replaces the email-capture form there: instead of asking for an email
 * (and then... mailing matches later), we drop the visitor's actual
 * question straight into the AI concierge drawer on the same page. The
 * drawer auto-sends their text as the first user turn, the bot replies,
 * the conversation is one motion.
 *
 * Props:
 *   - placeholder: the visible cue inside the input ("e.g. couples shoot
 *     in Cascais next week"). Caller supplies a localised, location-aware
 *     placeholder so the example matches the page.
 *   - cta: button label.
 *   - locationName: the page's location (e.g. "Algarve"). When set we
 *     auto-append " in {location}" to the visitor's text if they didn't
 *     already mention it — otherwise the bot replies generically without
 *     knowing they're on /locations/algarve. Page context still goes
 *     through pageContext, but a verbatim location in the user message
 *     is what the model actually anchors on.
 */
export function ConciergeQuickStart({
  placeholder,
  cta,
  locationName,
}: {
  placeholder: string;
  cta: string;
  locationName?: string;
}) {
  const t = useTranslations("locations.detail.quickStart");
  const drawer = useConciergeDrawer();
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    let messageText = trimmed;
    if (locationName) {
      const inLocation = new RegExp(`\\b${locationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (!inLocation.test(trimmed)) {
        messageText = `${trimmed} in ${locationName}`;
      }
    }
    drawer.openWith(messageText);
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          // text-base on mobile (16px) avoids iOS Safari auto-zoom on
          // focus; we step down to 15px on desktop where zoom is N/A.
          // Translucent input matches the surrounding frosted-glass panel.
          className="flex-1 min-w-0 rounded-xl border border-white/20 bg-white/15 px-4 py-3 text-base text-white placeholder-white/60 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/30 sm:text-[15px]"
          aria-label={t("inputLabel")}
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          // No `disabled:opacity-50` — visitor wants the CTA to read as
          // "active and inviting" at first glance even when the input is
          // empty. The `disabled` attribute still gates the actual submit
          // (handleSubmit early-returns on empty), it just doesn't dim
          // the visuals.
          className="shrink-0 rounded-xl bg-primary-600 px-5 py-3 text-base font-bold text-white shadow-lg transition hover:bg-primary-700 sm:px-6"
        >
          {cta}
        </button>
      </div>
      <p className="mt-2 text-xs text-white/60">{t("footnote")}</p>
    </form>
  );
}

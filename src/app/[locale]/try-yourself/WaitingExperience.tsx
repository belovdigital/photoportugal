"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

interface PortfolioPhoto {
  url: string;
  photographerSlug: string;
  photographerName: string;
  photographerRating: number | null;
  locationSlug: string | null;
  shootType: string | null;
}

interface MatchedPhotographer {
  slug: string;
  name: string;
  coverUrl: string | null;
  rating: number | null;
  reviewCount: number;
  minPrice: number | null;
  tagline: string | null;
}

type ChatMsg = { role: "user" | "assistant"; content: string };

const SWIPE_DECK_SIZE = 10;

export function WaitingExperience({
  locale,
  loc,
  progressPercent,
}: {
  locale: string;
  loc: string;
  progressPercent: number;
}) {
  const t = useTranslations("tryYourself");
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]);
  const [swipeIdx, setSwipeIdx] = useState(0);
  const [lovedTypes, setLovedTypes] = useState<string[]>([]);
  const [matches, setMatches] = useState<MatchedPhotographer[] | null>(null);

  // Inline concierge chat state
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ai-generate/portfolio-reel?loc=${encodeURIComponent(loc)}`)
      .then((r) => r.json())
      .then((d) => setPhotos((d.photos || []).slice(0, SWIPE_DECK_SIZE)))
      .catch(() => { /* silent */ });
  }, [loc]);

  // Seed chat with a single contextual greeting (no API call needed for opening).
  useEffect(() => {
    if (chatMsgs.length === 0) {
      const locName = loc ? loc.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";
      const opening = locName ? t("chatOpeningWithLoc", { loc: locName }) : t("chatOpening");
      setChatMsgs([{ role: "assistant", content: opening }]);
    }
  }, [loc, t, chatMsgs.length]);

  const photographerHref = (slug: string) =>
    locale === "en" ? `/photographers/${slug}` : `/${locale}/photographers/${slug}`;
  const conciergeFullHref = useMemo(() => {
    const base = locale === "en" ? "/concierge" : `/${locale}/concierge`;
    const params = new URLSearchParams({ src: "try-yourself" });
    if (loc) params.set("loc", loc);
    if (lovedTypes[0]) params.set("type", lovedTypes[0]);
    return `${base}?${params.toString()}`;
  }, [locale, loc, lovedTypes]);

  const swipeDone = swipeIdx >= photos.length && photos.length > 0;

  // After swipe: fetch matches based on dominant loved shoot_type
  useEffect(() => {
    if (!swipeDone || matches !== null) return;
    const topType = mostFrequent(lovedTypes);
    const params = new URLSearchParams();
    if (loc) params.set("loc", loc);
    if (topType) params.set("type", topType);
    fetch(`/api/ai-generate/match-by-style?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setMatches(d.photographers || []))
      .catch(() => setMatches([]));
  }, [swipeDone, lovedTypes, loc, matches]);

  const onSwipe = (love: boolean) => {
    const cur = photos[swipeIdx];
    if (love && cur?.shootType) {
      setLovedTypes((arr) => [...arr, cur.shootType!]);
    }
    setSwipeIdx((i) => i + 1);
  };

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    setChatInput("");
    const userMsg: ChatMsg = { role: "user", content: text };
    setChatMsgs((m) => [...m, userMsg]);
    setChatSending(true);
    try {
      const r = await fetch("/api/concierge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...chatMsgs, userMsg].slice(-12),
          chat_id: chatId,
          page_context: `Visitor is on /try-yourself waiting for an AI preview at ${loc || "Portugal"}. They came from an ad. Treat this as a normal concierge chat — match them with photographers when ready.`,
        }),
      });
      if (!r.ok) throw new Error("chat failed");
      const data = await r.json();
      if (data.chat_id) setChatId(data.chat_id);
      const assistantText: string = data.reply || "—";
      setChatMsgs((m) => [...m, { role: "assistant", content: assistantText }]);
    } catch {
      setChatMsgs((m) => [...m, { role: "assistant", content: t("chatError") }]);
    }
    setChatSending(false);
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      {/* Progress bar */}
      <div className="rounded-2xl bg-white border border-warm-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900">{t("waitingProgress")}</p>
          <span className="text-sm font-mono text-primary-700">{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-warm-100">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">{generatingHintByPercent(progressPercent, t)}</p>
      </div>

      {/* Tinder swipe — until done. After: matched photographers card */}
      {!swipeDone && photos.length > 0 ? (
        <SwipeDeck
          photos={photos}
          idx={swipeIdx}
          onLove={() => onSwipe(true)}
          onSkip={() => onSwipe(false)}
          photographerHref={photographerHref}
          t={t}
        />
      ) : swipeDone ? (
        <MatchesCard
          matches={matches}
          loc={loc}
          conciergeHref={conciergeFullHref}
          photographerHref={photographerHref}
          t={t}
        />
      ) : null}

      {/* Trust stats — three big cards always visible */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard big="30+" label={t("statBigPhotographers")} icon="📸" />
        <StatCard big="4.9★" label={t("statBigRating")} icon="⭐" />
        <StatCard big="€90" label={t("statBigFromPrice")} icon="💶" />
      </div>

      {/* Inline concierge chat — same backend as /concierge */}
      <ChatPanel
        messages={chatMsgs}
        input={chatInput}
        sending={chatSending}
        onChange={setChatInput}
        onSend={sendChat}
        t={t}
      />
    </div>
  );
}

function SwipeDeck({
  photos, idx, onLove, onSkip, photographerHref, t,
}: {
  photos: PortfolioPhoto[];
  idx: number;
  onLove: () => void;
  onSkip: () => void;
  photographerHref: (slug: string) => string;
  t: ReturnType<typeof useTranslations>;
}) {
  const cur = photos[idx];
  const next = photos[idx + 1];
  if (!cur) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary-50 via-white to-accent-50 border-2 border-primary-200 p-4 sm:p-5 shadow-md">
      <div className="text-center">
        <p className="font-display text-lg sm:text-xl font-bold text-gray-900">{t("swipeTitle")}</p>
        <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
          {t("swipeProgress", { current: idx + 1, total: photos.length })}
        </p>
      </div>

      <div className="relative mt-4 aspect-[4/5] max-w-xs mx-auto">
        {/* Next card peek for stack effect */}
        {next && (
          <div className="absolute inset-0 translate-y-2 scale-[0.96] rounded-2xl bg-warm-200 shadow-sm" aria-hidden />
        )}
        {/* Top card */}
        <a
          href={photographerHref(cur.photographerSlug)}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block h-full overflow-hidden rounded-2xl bg-warm-100 shadow-xl ring-1 ring-black/5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={cur.url}
            src={cur.url}
            alt={cur.photographerName}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <p className="font-display text-base font-bold drop-shadow">{cur.photographerName}</p>
            <div className="mt-0.5 text-xs opacity-95 flex items-center gap-2">
              {cur.photographerRating && <span>★ {cur.photographerRating.toFixed(1)}</span>}
              <span className="font-semibold opacity-90">{t("viewProfile")}</span>
            </div>
          </div>
        </a>
      </div>

      {/* Action buttons — big skip / love */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-gray-500 ring-2 ring-gray-300 shadow-md transition hover:scale-110 hover:ring-gray-400 active:scale-95"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onLove}
          aria-label="Love"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-primary-600 text-white shadow-xl shadow-primary-500/40 transition hover:scale-110 active:scale-95"
        >
          <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-gray-500">{t("swipeHint")}</p>
    </div>
  );
}

function MatchesCard({
  matches, loc, conciergeHref, photographerHref, t,
}: {
  matches: MatchedPhotographer[] | null;
  loc: string;
  conciergeHref: string;
  photographerHref: (slug: string) => string;
  t: ReturnType<typeof useTranslations>;
}) {
  void loc;
  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary-50 via-white to-accent-50 border-2 border-primary-200 p-4 sm:p-5 shadow-md">
      <div className="text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white text-2xl shadow-lg">
          🎯
        </div>
        <p className="mt-3 font-display text-lg sm:text-xl font-bold text-gray-900">{t("matchesTitle")}</p>
        <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-md mx-auto">{t("matchesBody")}</p>
      </div>

      {matches === null ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-warm-200 animate-pulse" />
          ))}
        </div>
      ) : matches.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {matches.map((p) => (
            <a
              key={p.slug}
              href={photographerHref(p.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-warm-200 bg-warm-100 shadow-sm transition hover:shadow-md"
            >
              {p.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverUrl} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary-100 to-warm-200" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-2 text-white">
                <p className="font-semibold text-xs leading-tight truncate">{p.name}</p>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] opacity-95">
                  {p.rating && <span>★ {p.rating.toFixed(1)}</span>}
                  {p.minPrice && <span className="font-semibold ml-auto">€{p.minPrice}</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : null}

      <a
        href={conciergeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm sm:text-base font-semibold text-white shadow-md hover:bg-primary-700"
      >
        {t("matchesCta")}
      </a>
    </div>
  );
}

function ChatPanel({
  messages, input, sending, onChange, onSend, t,
}: {
  messages: ChatMsg[];
  input: string;
  sending: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-2xl bg-white border border-warm-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-warm-200 bg-warm-50/50 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
        </span>
        <p className="font-display text-base font-bold text-gray-900">{t("chatTitle")}</p>
        <p className="ml-auto text-xs text-gray-500">{t("chatSubtitle")}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-72">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
                m.role === "user"
                  ? "bg-primary-600 text-white"
                  : "bg-warm-100 text-gray-900"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-warm-100 px-3.5 py-2 text-[13.5px] text-gray-500">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>
      <form
        className="border-t border-warm-200 p-3 flex items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); onSend(); }}
      >
        <textarea
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={t("chatPlaceholder")}
          rows={1}
          disabled={sending}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 max-h-24"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function StatCard({ big, label, icon }: { big: string; label: string; icon: string }) {
  return (
    <div className="rounded-xl bg-white border border-warm-200 p-3 sm:p-4 text-center shadow-sm">
      <p className="text-xs text-gray-500">{icon}</p>
      <p className="mt-0.5 font-display text-xl sm:text-2xl font-bold text-primary-700 tabular-nums leading-none">
        {big}
      </p>
      <p className="mt-1 text-[10px] sm:text-xs text-gray-600 leading-tight">{label}</p>
    </div>
  );
}

function generatingHintByPercent(pct: number, t: ReturnType<typeof useTranslations>): string {
  if (pct < 30) return t("hintEarly");
  if (pct < 70) return t("hintMid");
  return t("hintLong");
}

function mostFrequent(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts = new Map<string, number>();
  for (const x of arr) counts.set(x, (counts.get(x) || 0) + 1);
  let best: string | null = null;
  let max = 0;
  for (const [k, v] of counts) if (v > max) { max = v; best = k; }
  return best;
}

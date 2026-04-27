"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

function humanizeSlug(s: string): string {
  return s
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface MatchPhotographer {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  rating: number;
  review_count: number;
  locations: string[];
  shoot_types: string[];
  min_price: number | null;
  avatar_url: string | null;
  cover_url: string | null;
  sample_portfolio_url: string | null;
  reasoning: string;
  last_seen_at?: string | null;
  sample_review?: { text: string; client_name: string | null } | null;
}

interface LocationOption {
  slug: string;
  name: string;
  name_pt?: string;
  name_de?: string;
  name_es?: string;
  name_fr?: string;
  region: string;
  cover_image?: string;
  reason: string;
}

type Action =
  | { type: "show_matches"; data: { matches: MatchPhotographer[]; reply_text: string } }
  | { type: "show_locations"; data: { locations: LocationOption[]; reply_text: string } }
  | { type: "human_handoff"; data: { reason: string; summary: string } };

interface Msg {
  role: "user" | "assistant";
  content: string;
  action?: Action | null;
}

export function ConciergeChat({ locale, source, pageContext, embedded }: { locale: string; source?: "page" | "drawer"; pageContext?: string; embedded?: boolean }) {
  const t = useTranslations("concierge");
  const { data: session } = useSession();
  const search = useSearchParams();

  // Tailor the opening message based on landing-page query params (set by ad campaigns
  // and the /try-yourself handoff). Falls back to the generic greeting when no context.
  const openingContent = useMemo(() => {
    const src = search.get("src");
    const loc = search.get("loc");
    const type = search.get("type");
    const locName = loc ? humanizeSlug(loc) : null;
    if (src === "try-yourself" && locName) {
      return t("openingTryYourself", { loc: locName });
    }
    if (locName && type) {
      return t("openingLocAndType", { loc: locName, type: type.replace(/-/g, " ") });
    }
    if (locName) {
      return t("openingLoc", { loc: locName });
    }
    return t("openingMessage");
  }, [search, t]);
  const initialOpening: Msg = { role: "assistant", content: openingContent };
  const [messages, setMessages] = useState<Msg[]>([initialOpening]);
  void locale;
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [matchesShown, setMatchesShown] = useState(false);
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const lastAssistantMsgRef = useRef<HTMLDivElement>(null);
  const lastMessageRoleRef = useRef<"user" | "assistant" | null>(null);


  function getVisitorId() {
    try {
      const m = document.cookie.match(/(?:^|; )vid=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch { return null; }
  }

  // Hydrate existing chat from server on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const visitorId = getVisitorId();
        const userId = (session?.user as { id?: string } | undefined)?.id;
        if (!visitorId && !userId) { setHydrated(true); return; }
        const params = new URLSearchParams();
        if (visitorId) params.set("visitor_id", visitorId);
        if (userId) params.set("user_id", userId);
        const res = await fetch(`/api/concierge/load?${params.toString()}`);
        if (!res.ok) { setHydrated(true); return; }
        const data = await res.json();
        if (cancelled) return;
        if (data.chat && Array.isArray(data.chat.messages) && data.chat.messages.length > 0) {
          setChatId(data.chat.id);
          setMessages(data.chat.messages);
          if (data.chat.email) setEmailCaptured(true);
          const hasMatches = data.chat.messages.some((m: Msg) => m.action?.type === "show_matches");
          if (hasMatches) setMatchesShown(true);
        }
      } catch {}
      finally { if (!cancelled) setHydrated(true); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]);

  async function startOver() {
    // Archive ALL chats for this visitor (not just current) so reload truly clears.
    fetch("/api/concierge/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, visitor_id: getVisitorId() }),
    }).catch(() => {});
    setChatId(null);
    setMessages([initialOpening]);
    setMatchesShown(false);
    setEmailCaptured(false);
    setEmailValue("");
    setShowSavedToast(false);
    lastMessageRoleRef.current = null;
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // After hydration: snap to bottom (most recent message) without animation
  useEffect(() => {
    if (!hydrated) return;
    const container = scrollRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
      // Mark current last role so subsequent smart-scroll doesn't re-trigger
      lastMessageRoleRef.current = messages[messages.length - 1]?.role || null;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Smart scroll — only inside the chat window, never the page.
  // - When user sends → scroll user message into view at bottom
  // - When assistant replies → scroll to TOP of that assistant message
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (lastMessageRoleRef.current === last.role) return;
    lastMessageRoleRef.current = last.role;
    const target = last.role === "assistant" ? lastAssistantMsgRef.current : lastUserMsgRef.current;
    const container = scrollRef.current;
    if (!target || !container) return;
    requestAnimationFrame(() => {
      const targetTop = target.offsetTop - container.offsetTop;
      const desiredTop =
        last.role === "assistant"
          ? Math.max(0, targetTop - 12) // pin start of AI msg near top of chat
          : Math.max(0, targetTop - container.clientHeight + target.offsetHeight + 60); // user msg visible near bottom
      container.scrollTo({ top: desiredTop, behavior: "smooth" });
    });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const newMessages: Msg[] = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/concierge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          visitor_id: getVisitorId(),
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          language: navigator.language?.slice(0, 2) || "en",
          source: source || "page",
          page_context: pageContext,
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (data.chat_id) setChatId(data.chat_id);
      const action = data.action || null;
      setMessages([...newMessages, { role: "assistant" as const, content: data.reply || "", action }]);
      if (action?.type === "show_matches") setMatchesShown(true);
    } catch (err) {
      console.error(err);
      setMessages([...newMessages, { role: "assistant" as const, content: t("errorRetry"), action: null }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValue.includes("@") || !chatId || emailSubmitting) return;
    setEmailSubmitting(true);
    try {
      const res = await fetch("/api/concierge/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, email: emailValue.trim() }),
      });
      if (res.ok) {
        setEmailCaptured(true);
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 6000);
      }
    } catch {}
    finally { setEmailSubmitting(false); }
  }

  return (
    <div className={`relative flex h-full flex-1 flex-col overflow-hidden border-warm-200 bg-white lg:h-full ${embedded ? "" : "sm:rounded-2xl sm:border sm:shadow-sm"}`}>
      {/* Start over — only show if user has sent at least one message */}
      {messages.length > 1 && (
        <div className="absolute right-4 top-2 z-10 flex justify-end sm:right-5 sm:top-2">
          <button
            type="button"
            onClick={startOver}
            className="flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-gray-500 shadow-sm ring-1 ring-warm-200 backdrop-blur-sm transition hover:bg-white hover:text-primary-700 hover:ring-primary-200"
            title={t("startOver")}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t("startOver")}
          </button>
        </div>
      )}
      {/* Chat scroll area — flex-1 fills available column height
          overscroll-contain prevents page scroll-chaining. */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 [scrollbar-gutter:stable]">
        <div className="space-y-4">
          {messages.map((m, i) => {
            const isVeryLast = i === messages.length - 1;
            const ref =
              isVeryLast
                ? (m.role === "user" ? lastUserMsgRef : lastAssistantMsgRef)
                : undefined;
            return (
            <div key={i} ref={ref} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%]">
                {m.role === "assistant" && i === 0 && (
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                    <img src="/logo-icon.png" alt="" className="h-4 w-4 rounded" />
                    {t("conciergeBadge")}
                  </div>
                )}
                <div
                  className={`inline-block rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary-600 text-white"
                      : "bg-warm-100 text-gray-900"
                  }`}
                >
                  {m.content}
                </div>

                {m.action?.type === "show_matches" && (
                  <div className="mt-3 space-y-3">
                    {m.action.data.matches.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-2xl bg-warm-100 p-2.5 sm:p-3"
                      >
                        {p.reasoning && (
                          <p className="mb-2 px-1 text-[14px] leading-relaxed text-gray-700 sm:text-[15px]">
                            {p.reasoning}
                          </p>
                        )}
                        <PhotographerMatchCard
                          p={p}
                          locale={locale}
                          chatContext={messages.filter(x => x.role === "user").slice(-3).map(x => x.content).join(" / ")}
                        />
                      </div>
                    ))}
                    {emailCaptured && i === messages.length - 1 && (
                      <ResendMatchesButton chatId={chatId} locale={locale} />
                    )}
                  </div>
                )}

                {m.action?.type === "show_locations" && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {m.action.data.locations.map((loc) => (
                      <LocationOptionCard
                        key={loc.slug}
                        loc={loc}
                        locale={locale}
                        disabled={i !== messages.length - 1 || sending}
                        onPick={(name) => send(name)}
                      />
                    ))}
                  </div>
                )}

                {m.action?.type === "human_handoff" && (
                  <HumanHandoffBox chatId={chatId} locale={locale} summary={m.action.data.summary} />
                )}
              </div>
            </div>
            );
          })}

          {sending && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-1 rounded-2xl bg-warm-100 px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email capture (only after first matches shown). Compact single-row UI. */}
      {matchesShown && !emailCaptured && (
        <div className="border-t border-warm-100 bg-primary-50/40 px-4 py-2 sm:px-6">
          <form onSubmit={submitEmail} className="flex items-center gap-2">
            <span className="text-base shrink-0" aria-hidden>💌</span>
            <input
              type="email"
              required
              placeholder={t("emailPlaceholder")}
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
            <button
              type="submit"
              disabled={!emailValue.includes("@") || emailSubmitting}
              className="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {emailSubmitting ? "…" : t("saveBtn")}
            </button>
          </form>
        </div>
      )}

      {showSavedToast && (
        <div className="border-t border-warm-100 bg-emerald-50 px-4 py-2.5 text-center text-sm text-emerald-800 sm:px-6 transition-opacity">
          {t("savedToast")}
        </div>
      )}

      {/* WhatsApp resume — appears after at least 2 user messages, hidden after click */}
      {messages.filter(m => m.role === "user").length >= 2 && (
        <WhatsAppResumeBar locale={locale} userMessages={messages.filter(m => m.role === "user").slice(-3).map(m => m.content)} />
      )}

      {/* Input */}
      <div className="border-t border-warm-100 bg-warm-50/50 p-3 sm:p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={t("inputPlaceholder")}
            className="flex-1 resize-none rounded-xl border border-warm-200 bg-white px-3.5 py-2.5 text-[15px] focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            style={{ minHeight: "44px", maxHeight: "120px" }}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white transition hover:bg-primary-700 disabled:opacity-50"
            aria-label={t("send")}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9-7-9-7M3 12h17" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

function LocationOptionCard({ loc, locale, disabled, onPick }: { loc: LocationOption; locale: string; disabled: boolean; onPick: (name: string) => void }) {
  const displayName =
    (locale === "pt" && loc.name_pt) ||
    (locale === "de" && loc.name_de) ||
    (locale === "es" && loc.name_es) ||
    (locale === "fr" && loc.name_fr) ||
    loc.name;
  const cover = loc.cover_image;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(displayName)}
      className="group relative overflow-hidden rounded-xl border border-warm-200 bg-white text-left transition hover:border-primary-300 hover:shadow-md disabled:opacity-60"
    >
      {cover && (
        <div className="aspect-[16/9] w-full overflow-hidden bg-warm-100">
          <OptimizedImage src={cover} alt={displayName} width={400} className="h-full w-full transition group-hover:scale-[1.02]" />
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-bold text-gray-900">{displayName}</p>
        <p className="mt-1 text-[12px] leading-snug text-gray-600">{loc.reason}</p>
      </div>
    </button>
  );
}

function presenceBadge(lastSeen: string | null | undefined, t: (key: string) => string): { color: string; label: string } | null {
  if (!lastSeen) return null;
  const ts = new Date(lastSeen).getTime();
  if (!isFinite(ts)) return null;
  const minsAgo = (Date.now() - ts) / 60000;
  if (minsAgo < 60) return { color: "bg-emerald-500", label: t("presenceOnline") };
  if (minsAgo < 60 * 24) return { color: "bg-amber-400", label: t("presenceActiveToday") };
  if (minsAgo < 60 * 24 * 7) return { color: "bg-amber-300", label: t("presenceActiveWeek") };
  return null;
}

function WhatsAppResumeBar({ userMessages }: { locale: string; userMessages: string[] }) {
  const t = useTranslations("concierge");
  const tc = useTranslations("common");
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  // Build a clean single-paragraph summary from the most informative user messages.
  // Take the LAST substantive message (>30 chars) as primary intent — it usually has the most refined detail.
  // Otherwise fall back to concatenating the last 2.
  const substantive = userMessages.filter(m => m && m.trim().length > 30);
  const primary = substantive.slice(-1)[0] || userMessages.slice(-1)[0] || "";
  const cleanIntent = primary.trim().slice(0, 280);

  const greeting = t("whatsappGreeting");
  const intentLabel = t("whatsappIntentLabel");

  const text = encodeURIComponent(`${greeting}\n\n${intentLabel}\n${cleanIntent}`);
  const waUrl = `https://wa.me/351962598883?text=${text}`;
  const label = t("whatsappContinue");
  const sub = t("whatsappTalkHuman");
  return (
    <div className="border-t border-warm-100 bg-emerald-50/60 px-4 py-2 sm:px-6">
      <div className="flex items-center justify-between gap-2">
        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.6 6.32A7.85 7.85 0 0012.05 4a7.94 7.94 0 00-6.88 11.92L4 20l4.18-1.1a7.93 7.93 0 003.86 1h.01c4.38 0 7.94-3.56 7.95-7.94a7.9 7.9 0 00-2.4-5.64zM12.05 18.5h-.01a6.6 6.6 0 01-3.36-.92l-.24-.14-2.48.65.66-2.42-.16-.25a6.6 6.6 0 1112.21-3.5 6.6 6.6 0 01-6.62 6.58zm3.62-4.94c-.2-.1-1.18-.58-1.36-.65-.18-.07-.32-.1-.45.1-.13.2-.51.65-.63.78-.12.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.99-.59-.52-.99-1.17-1.1-1.37-.12-.2-.01-.31.09-.41.09-.09.2-.23.3-.35.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.45-1.08-.61-1.48-.16-.39-.33-.34-.45-.34l-.39-.01a.74.74 0 00-.54.25c-.18.2-.71.69-.71 1.69s.73 1.96.83 2.09c.1.13 1.43 2.18 3.46 3.06.48.21.86.33 1.16.43.49.16.93.13 1.28.08.39-.06 1.18-.48 1.35-.95.17-.46.17-.86.12-.95-.05-.09-.18-.14-.38-.24z"/></svg>
          <span className="flex flex-col leading-tight">
            <span>{label}</span>
            <span className="text-[10px] font-normal text-emerald-700">{sub}</span>
          </span>
        </a>
        <button onClick={() => setDismissed(true)} className="rounded-full p-1 text-emerald-600 hover:bg-emerald-100" aria-label={tc("dismiss")}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function PhotographerMatchCard({ p, locale, chatContext }: { p: MatchPhotographer; locale: string; chatContext: string }) {
  const t = useTranslations("concierge");
  const cover = p.sample_portfolio_url || p.cover_url || p.avatar_url;
  const firstName = p.name.split(" ")[0];
  const presence = presenceBadge(p.last_seen_at, t);
  const prefill = chatContext
    ? encodeURIComponent(`${t("prefillIntro")}\n\n${chatContext}`.slice(0, 1000))
    : "";
  const bookHref = `/${locale}/book/${p.slug}?from=concierge${prefill ? `&prefill_message=${prefill}` : ""}`;
  const locationLabel = p.locations.slice(0, 2).map(l => l.charAt(0).toUpperCase() + l.slice(1).replace(/-/g, " ")).join(" · ");
  return (
    <div className="overflow-hidden rounded-xl border border-warm-200 bg-white">
      {cover && (
        <div className="relative aspect-[5/3] w-full overflow-hidden bg-warm-100">
          <OptimizedImage src={cover} alt={p.name} width={600} className="h-full w-full" />
          {presence && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm backdrop-blur-sm">
              <span className={`h-1.5 w-1.5 rounded-full ${presence.color}`} />
              {presence.label}
            </span>
          )}
        </div>
      )}
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-bold text-gray-900">{p.name}</p>
          {p.review_count > 0 ? (
            <p className="shrink-0 text-[13px] font-bold text-gray-900">
              ⭐ {p.rating.toFixed(1)}
              <span className="ml-0.5 text-[10px] font-medium text-gray-500">({p.review_count})</span>
            </p>
          ) : (
            <p className="shrink-0 text-[11px] font-medium text-amber-600">{t("newBadge")}</p>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-[12px] text-gray-500">
          <span className="min-w-0 truncate">{locationLabel}</span>
          {p.min_price && (
            <span className="shrink-0 font-semibold text-gray-900">€{p.min_price}+</span>
          )}
        </div>
      </div>
      <div className="flex items-stretch border-t border-warm-100">
        <a
          href={`/${locale}/photographers/${p.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 px-3 py-2 text-center text-[13px] font-medium text-gray-600 transition hover:bg-warm-50"
        >
          {t("viewProfile")}
        </a>
        <a
          href={bookHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 border-l border-warm-100 bg-primary-600 px-3 py-2 text-center text-[13px] font-semibold text-white transition hover:bg-primary-700"
        >
          {t("talkTo", { name: firstName })}
        </a>
      </div>
    </div>
  );
}

function ResendMatchesButton({ chatId }: { chatId: string | null; locale: string }) {
  const t = useTranslations("concierge");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function send() {
    if (!chatId || state !== "idle") return;
    setState("sending");
    try {
      const res = await fetch("/api/concierge/email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      });
      setState(res.ok ? "sent" : "idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "sent") {
    return <p className="mt-1 text-center text-xs text-emerald-700">{t("emailSent")}</p>;
  }

  return (
    <button
      onClick={send}
      disabled={state === "sending"}
      className="mt-1 w-full rounded-lg border border-dashed border-warm-300 bg-warm-50 px-3 py-2 text-center text-xs font-medium text-gray-600 transition hover:bg-warm-100 hover:text-primary-700 disabled:opacity-50"
    >
      {state === "sending" ? t("emailSending") : t("emailMeThese")}
    </button>
  );
}

function HumanHandoffBox({ chatId, summary }: { chatId: string | null; locale: string; summary: string }) {
  const t = useTranslations("concierge");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatId || !email.includes("@")) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/concierge/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, email, first_name: name, summary }),
      });
      if (res.ok) setSubmitted(true);
    } catch {}
    finally { setSubmitting(false); }
  }

  if (submitted) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        {t("handoffSubmitted")}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-warm-200 bg-warm-50 p-4">
      <p className="text-sm text-gray-700">{t("handoffPrompt")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          placeholder={t("handoffNamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
        <input
          type="email"
          required
          placeholder={t("handoffEmailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
        <button
          type="submit"
          disabled={!email.includes("@") || submitting}
          className="rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? t("handoffSendingBtn") : t("handoffSubmitBtn")}
        </button>
      </div>
    </form>
  );
}

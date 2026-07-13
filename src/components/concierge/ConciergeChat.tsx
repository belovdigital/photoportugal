"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { PhotographerCardCover } from "@/components/ui/PhotographerCardCover";
import { useConciergeDrawer } from "@/components/concierge/ConciergeDrawer";

function humanizeSlug(s: string): string {
  return s
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Render the very small markdown subset the GPT concierge actually emits:
 *  `**bold**`, `*italic*`, `[label](/internal-path)` links, line breaks.
 *  Links are INTERNAL-ONLY (href must start with "/") — the LLM must never
 *  be able to emit a clickable external URL. Everything else passes through
 *  as plain text. Pulling in a full markdown library for this is overkill. */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Order matters: [link](…) first, then **bold**, then *italic*.
  const re = /(\[([^\]\n]+)\]\((\/[^)\s]*)\)|\*\*([^*]+?)\*\*|\*([^*\n]+?)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined && m[3] !== undefined) {
      parts.push(
        <a key={key++} href={m[3]} className="font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800">
          {m[2]}
        </a>
      );
    } else if (m[4] !== undefined) {
      parts.push(<strong key={key++}>{m[4]}</strong>);
    } else if (m[5] !== undefined) {
      parts.push(<em key={key++}>{m[5]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {renderInline(line)}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

function readStoredAttribution() {
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "gclid"] as const;
  const out: Partial<Record<(typeof keys)[number], string>> = {};
  for (const key of keys) {
    try {
      const direct = new URLSearchParams(window.location.search).get(key);
      if (direct) {
        out[key] = direct;
        continue;
      }
      const sessionValue = sessionStorage.getItem(key);
      if (sessionValue) {
        out[key] = sessionValue;
        continue;
      }
      const raw = localStorage.getItem(`pp_${key}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { v?: string; ts?: number };
      if (!parsed.v) continue;
      const ageMs = Date.now() - Number(parsed.ts || 0);
      if (Number.isFinite(ageMs) && ageMs > 90 * 864e5) continue;
      out[key] = parsed.v;
    } catch {}
  }
  if (out.gclid && !out.utm_source) out.utm_source = "google";
  if (out.gclid && !out.utm_medium) out.utm_medium = "cpc";
  return out;
}

interface MatchBadge {
  type: string;
  label: string;
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
  cover_position_y?: number | null;
  sample_portfolio_url: string | null;
  portfolio_thumbs?: string[];
  reasoning: string;
  last_seen_at?: string | null;
  sample_review?: { text: string; client_name: string | null } | null;
  /** Optional 1-3 word AI-picked stylistic tag, e.g. "Cinematic style". */
  style_label?: string;
  /** Server-computed badges (best_match, fastest_responder, etc.). Max 2. */
  badges?: MatchBadge[];
  /** Date-availability check result if the visitor mentioned a date.
   *  null when no date was extracted or check failed. */
  availability?: { date: string; available: boolean; label: string } | null;
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

interface SpotOption {
  city: string;
  slug: string;
  name: string;
  name_pt?: string;
  name_de?: string;
  name_es?: string;
  name_fr?: string;
  description: string;
  cover_image?: string | null;
  reason: string;
}

type Action =
  | { type: "show_matches"; data: { matches: MatchPhotographer[]; reply_text: string } }
  | { type: "show_locations"; data: { locations: LocationOption[]; reply_text: string } }
  | { type: "show_spots"; data: { spots: SpotOption[]; reply_text: string } }
  | { type: "human_handoff"; data: { reason: string; summary: string } }
  | {
      type: "offer_blind_booking";
      data: {
        hold_id: string;
        region: string;
        slug: string;
        date: string;
        occasion: string;
        party_size: number;
        duration_minutes: number;
        // price_eur is the ALL-INCLUSIVE summer-offer total the client pays
        // (regional inclusive × 9+-group multiplier) — charged straight.
        price_eur: number;
        regional_base_eur?: number;
        compare_at_eur?: number;
        savings_eur?: number;
        large_group_applied?: boolean;
        sample_size: number;
        reply_text: string;
      };
    };

interface Msg {
  role: "user" | "assistant";
  content: string;
  action?: Action | null;
  /** Marks the client-side "Lens" nudge so the renderer can attach
   *  example-prompt chips below it. Not persisted server-side. */
  isNudge?: boolean;
  nudgeChips?: string[];
}

export function ConciergeChat({ locale, source, pageContext, pageContextObj, embedded }: { locale: string; source?: "page" | "drawer"; pageContext?: string; pageContextObj?: import("@/lib/concierge/page-context").PageContext; embedded?: boolean }) {
  const t = useTranslations("concierge");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const search = useSearchParams();

  // Tailor the opening message. Priority:
  //   1. Structured pageContextObj from the drawer → context-aware intro
  //      with chips (handles location/occasion/photographer/booking pages)
  //   2. Legacy URL search params (src/loc/type) — used by /concierge page
  //      from ad campaigns + the /try-yourself handoff
  //   3. Generic openingMessage
  const initialOpening = useMemo<Msg>(() => {
    if (pageContextObj) {
      // Lazy import — pure function, no side effects
      const { getIntroTemplate } = require("@/lib/concierge/intro-templates") as typeof import("@/lib/concierge/intro-templates");
      const tpl = getIntroTemplate(pageContextObj);
      if (tpl) {
        return {
          role: "assistant",
          content: tpl.message,
          isNudge: true,            // reuse the nudge chip-rendering UI
          nudgeChips: tpl.chips,
        };
      }
    }
    const src = search.get("src");
    const loc = search.get("loc");
    const type = search.get("type");
    const locName = loc ? humanizeSlug(loc) : null;
    let content: string;
    if (src === "try-yourself" && locName) {
      content = t("openingTryYourself", { loc: locName });
    } else if (locName && type) {
      content = t("openingLocAndType", { loc: locName, type: type.replace(/-/g, " ") });
    } else if (locName) {
      content = t("openingLoc", { loc: locName });
    } else {
      content = t("openingMessage");
    }
    return { role: "assistant", content };
  }, [pageContextObj, search, t]);
  const [messages, setMessages] = useState<Msg[]>([initialOpening]);
  void pageContext;
  void locale;
  // When the chat is opened via `openWith()` from the location-page hero
  // form, the drawer context carries the visitor's typed question. We
  // watch drawer.initialMessage in a useEffect (with a ref-based guard
  // against React 18 strict-mode double-invocation) so a SECOND submit
  // through the hero — while the drawer is already open — also fires.
  // Previously this only worked once: on mount the ref was set from the
  // pending message, but a later openWith() couldn't trigger a re-send
  // because the deps didn't change.
  const drawer = useConciergeDrawer();
  const lastSentInitialRef = useRef<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [matchesShown, setMatchesShown] = useState(false);
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  // Post-match capture flow. After matches are shown the visitor picks
  // a channel — Email (existing flow), WhatsApp (new), or skip. Email
  // path is unchanged; WhatsApp captures phone, saves the lead, opens
  // wa.me/<our-number> in a new tab.
  type CaptureMode = "choice" | "email" | "whatsapp";
  const [captureMode, setCaptureMode] = useState<CaptureMode>("choice");
  const [phoneValue, setPhoneValue] = useState("");
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  // Compare mode — visitor ticks 2-3 cards from a show_matches turn,
  // we pop a side-by-side modal so they can decide between them
  // without clicking through every profile separately.
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const allMatchesIndex = useMemo(() => {
    const out: Record<string, MatchPhotographer> = {};
    for (const m of messages) {
      if (m.action?.type === "show_matches") {
        for (const p of m.action.data.matches) out[p.slug] = p;
      }
    }
    return out;
  }, [messages]);
  const compareList = Array.from(compareSet).map((slug) => allMatchesIndex[slug]).filter(Boolean);
  function toggleCompare(slug: string) {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else if (next.size < 3) next.add(slug);
      return next;
    });
  }
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // In-chat contact prompt — when the visitor clicks "Ask a human" or
  // "Email me these matches" without having shared an email/phone yet,
  // the bot pushes an assistant message asking for a contact and we
  // surface an inline form. After they submit, we save the contact via
  // /api/concierge/email or /whatsapp and run the original intent.
  // Critical: the human handoff Telegram notification only fires AFTER
  // contact is saved — admin shouldn't get pinged for visitors who never
  // left a way to be reached.
  type ContactIntent = "ask_human" | "email_matches";
  const [pendingContact, setPendingContact] = useState<ContactIntent | null>(null);
  const [contactInput, setContactInput] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState(false);
  const hasContact = (emailValue && emailValue.includes("@")) || (phoneValue && phoneValue.replace(/\D/g, "").length >= 6);
  // Proactive nudge — once per session, ~90s after matches are shown if
  // the visitor hasn't given email/phone, the bot asks softly. Without
  // this, current data shows ~0% email capture: visitors browse the
  // matches and bounce, leaving us no way to follow up.
  const proactiveNudgeFiredRef = useRef(false);
  // The "shy nudge": after 5s of inactivity on an empty conversation,
  // Lens (the bot) sends a warm intro + 3 example-prompt chips. Visitors
  // often hesitate to type because the chat feels formal — the nudge
  // tells them outright "you're talking to AI, your message is private,
  // here are example questions". Once-per-session via sessionStorage.
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeFiredRef = useRef(false);
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
          if (data.chat.email) { setEmailValue(data.chat.email); setEmailCaptured(true); }
          if (data.chat.phone) { setPhoneValue(data.chat.phone); setEmailCaptured(true); }
          const hasMatches = data.chat.messages.some((m: Msg) => m.action?.type === "show_matches");
          if (hasMatches) setMatchesShown(true);
        }
      } catch {}
      finally { if (!cancelled) setHydrated(true); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]);

  // After hydration, if the drawer was opened via openWith(message),
  // auto-submit the visitor's question as their first user turn. Re-fires
  // every time drawer.initialMessage changes — covers both first mount
  // (drawer opens with a pending message) AND subsequent submits through
  // the hero plaque while the drawer is already open. Strict mode double-
  // invoke is guarded by lastSentInitialRef.
  useEffect(() => {
    if (!hydrated) return;
    const pending = drawer.initialMessage;
    if (!pending) {
      lastSentInitialRef.current = null;
      return;
    }
    if (lastSentInitialRef.current === pending) return;
    lastSentInitialRef.current = pending;
    const chip = drawer.initialChip;
    drawer.consumeInitialMessage();
    void send(pending, chip ? { sourceChip: chip } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, drawer.initialMessage]);

  // "Lens" nudge — fires 5s after the visitor opens an empty conversation
  // and only if they haven't started typing. Cancels itself if they do.
  // Stored once per session so reopening the drawer or refreshing inside
  // the same tab doesn't re-show it; new session = new nudge.
  function cancelNudgeTimer() {
    if (nudgeTimerRef.current) {
      clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
  }
  useEffect(() => {
    if (!hydrated) return;
    if (nudgeFiredRef.current) return;
    // Bail if there's already real history (rehydrated from server) — no
    // point nudging an active conversation.
    if (messages.length > 1) return;
    if (drawer.initialMessage) return;
    // If the initial opening already has chips (context-aware intro from a
    // drawer page like /locations/madeira), skip the shy nudge — the user
    // already has actionable buttons.
    if (messages[0]?.isNudge && messages[0]?.nudgeChips && messages[0].nudgeChips.length > 0) {
      nudgeFiredRef.current = true;
      return;
    }
    if (typeof window !== "undefined" && sessionStorage.getItem("concierge_nudged") === "1") {
      nudgeFiredRef.current = true;
      return;
    }
    nudgeTimerRef.current = setTimeout(() => {
      // Last-second guards: did anything change while waiting?
      if (nudgeFiredRef.current) return;
      if (input.trim().length > 0) return;
      if (sending) return;
      // Re-check messages length using a ref-style read (state in closure
      // is fine here since we early-returned above on >1).
      nudgeFiredRef.current = true;
      try { sessionStorage.setItem("concierge_nudged", "1"); } catch {}
      const chipKeys: ("chipProposal" | "chipCouples" | "chipFamily" | "chipExplore")[] =
        ["chipProposal", "chipCouples", "chipFamily", "chipExplore"];
      const chips = chipKeys.map((k) => t(`nudge.${k}`));
      const nudgeMsg: Msg = {
        role: "assistant",
        content: t("nudge.body"),
        isNudge: true,
        nudgeChips: chips,
      };
      setMessages((prev) => prev.length > 1 ? prev : [...prev, nudgeMsg]);
    }, 5000);
    return () => cancelNudgeTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

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

  // Auto-surface the email-capture form 2.5s after matches render —
  // shortened from a 90s nudge with a fresh assistant message, because
  // (a) visitors usually leave the tab well before 90s, killing the
  // single highest-leverage capture moment (over 30 days we sat at
  // 2 / 117 email capture — see memory note on concierge conversion),
  // and (b) the LLM now offers the email itself in the same turn as
  // show_matches (see "Email capture after show_matches" in the system
  // prompt), so injecting a second proactive message would double up
  // and feel pushy. The form just appears under the matches so the
  // visitor's email submission lines up with the LLM's offer.
  useEffect(() => {
    if (!matchesShown) return;
    if (hasContact) return;
    if (pendingContact !== null) return;
    if (proactiveNudgeFiredRef.current) return;
    const timer = setTimeout(() => {
      if (proactiveNudgeFiredRef.current) return;
      proactiveNudgeFiredRef.current = true;
      setPendingContact("email_matches");
      setContactError(false);
    }, 2_500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchesShown, hasContact, pendingContact]);

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

  async function send(text: string, opts?: { sourceChip?: string }) {
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
          // Pass `action` along so the server can dedupe photographers
          // already shown in this conversation and rotate to fresh ones
          // when the visitor asks for "more". Without this, shownSlugs on
          // the API side never accumulates across turns and "show me
          // others" can return the same picks.
          messages: newMessages.map(({ role, content, action }) => ({ role, content, action })),
          language: navigator.language?.slice(0, 2) || "en",
          source: source || "page",
          page_context: pageContext,
          page_context_obj: pageContextObj,
          attribution: readStoredAttribution(),
          // Verbatim chip the visitor clicked (only on first turn, before
          // chatId exists). Server saves it on INSERT for analytics.
          source_chip: !chatId && opts?.sourceChip ? opts.sourceChip : undefined,
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (data.chat_id) setChatId(data.chat_id);
      const action = data.action || null;
      setMessages([...newMessages, { role: "assistant" as const, content: data.reply || "", action }]);
      if (action?.type === "show_matches") setMatchesShown(true);
      // Sync contact captured by AI's request_human_match tool back to
      // parent state so `hasContact` flips immediately and the redundant
      // HumanHandoffBox form below the assistant bubble doesn't render.
      if (action?.type === "human_handoff") {
        const ce = (action.data as { contact_email?: string } | undefined)?.contact_email;
        const cp = (action.data as { contact_phone?: string } | undefined)?.contact_phone;
        if (ce && ce.includes("@") && !emailValue) setEmailValue(ce);
        if (cp && cp.replace(/\D/g, "").length >= 8 && !phoneValue) setPhoneValue(cp);
      }
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

  async function submitWhatsapp(e: React.FormEvent) {
    e.preventDefault();
    if (!chatId || phoneSubmitting) return;
    const cleaned = phoneValue.replace(/\D/g, "");
    if (cleaned.length < 6) return;
    setPhoneSubmitting(true);
    try {
      const res = await fetch("/api/concierge/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, phone: phoneValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        // Mark capture done and pop the wa.me link in a new tab so the
        // visitor lands in WhatsApp with a pre-filled message they can
        // send to us. The lead is already saved server-side at this point.
        setEmailCaptured(true);
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 6000);
        if (data.wa_url && typeof window !== "undefined") {
          window.open(data.wa_url, "_blank", "noopener,noreferrer");
        }
      }
    } catch {}
    finally { setPhoneSubmitting(false); }
  }

  // ---- In-chat contact prompt flow ----
  // Both AskHumanBar and ResendMatchesButton route through these helpers:
  // if we already have a contact (email or phone), the original action
  // fires immediately. Otherwise the bot pushes an assistant message and
  // surfaces the contact input form; the actual API call happens AFTER
  // the visitor submits a contact, so admin Telegram and email-resend
  // are never triggered without a way to reach the lead.
  async function fireAskHuman(emailOverride: string | null, summary?: string) {
    if (!chatId) return;
    try {
      await fetch("/api/concierge/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, manual: true, email: emailOverride, summary: summary || undefined }),
      });
    } catch {}
  }
  async function fireResendMatches() {
    if (!chatId) return;
    try {
      await fetch("/api/concierge/email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      });
    } catch {}
  }
  function startAskHuman() {
    if (!chatId) return;
    if (hasContact) {
      void fireAskHuman(emailValue || null);
      setMessages((prev) => [...prev, { role: "assistant", content: t("askHumanDone") }]);
      return;
    }
    setMessages((prev) => [...prev, { role: "assistant", content: t("contactPromptAskHuman") }]);
    setPendingContact("ask_human");
    setContactError(false);
  }
  function startEmailMatches() {
    if (!chatId) return;
    if (emailValue && emailValue.includes("@")) {
      void fireResendMatches();
      setMessages((prev) => [...prev, { role: "assistant", content: t("contactSavedEmailMatches", { contact: emailValue }) }]);
      return;
    }
    // Phone-only visitor — ping admin via handoff so we WhatsApp the
    // matches manually. Better than asking for email a second time.
    if (phoneValue && phoneValue.replace(/\D/g, "").length >= 6) {
      void fireAskHuman(null, "Visitor wants matches sent — phone given, no email. Send via WhatsApp.");
      setMessages((prev) => [...prev, { role: "assistant", content: t("contactSavedEmailMatchesPhone", { contact: phoneValue }) }]);
      return;
    }
    setMessages((prev) => [...prev, { role: "assistant", content: t("contactPromptEmailMatches") }]);
    setPendingContact("email_matches");
    setContactError(false);
  }
  async function submitInChatContact(e: React.FormEvent) {
    e.preventDefault();
    if (!chatId || contactSubmitting || !pendingContact) return;
    const trimmed = contactInput.trim();
    const isEmailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    const digits = trimmed.replace(/\D/g, "");
    const isPhoneLike = !isEmailLike && digits.length >= 6;
    if (!isEmailLike && !isPhoneLike) {
      setContactError(true);
      return;
    }
    setContactSubmitting(true);
    setContactError(false);
    try {
      // Save contact first
      if (isEmailLike) {
        await fetch("/api/concierge/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, email: trimmed }),
        });
        setEmailValue(trimmed);
      } else {
        await fetch("/api/concierge/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, phone: trimmed }),
        });
        setPhoneValue(trimmed);
      }
      setEmailCaptured(true);

      // Run the original intent now that we have a contact, then
      // confirm to the visitor inline.
      const intent = pendingContact;
      const contactDisplay = isEmailLike ? trimmed : trimmed;
      if (intent === "ask_human") {
        await fireAskHuman(isEmailLike ? trimmed : null);
        setMessages((prev) => [...prev, { role: "assistant", content: t("contactSavedAskHuman", { contact: contactDisplay }) }]);
      } else if (intent === "email_matches") {
        if (isEmailLike) {
          await fireResendMatches();
          setMessages((prev) => [...prev, { role: "assistant", content: t("contactSavedEmailMatches", { contact: contactDisplay }) }]);
        } else {
          // Phone given for "email me" — switch to WhatsApp delivery: notify
          // admins via handoff so we can send matches manually via WA.
          await fireAskHuman(null, "Visitor wants matches sent — phone given, no email. Send via WhatsApp.");
          setMessages((prev) => [...prev, { role: "assistant", content: t("contactSavedEmailMatchesPhone", { contact: contactDisplay }) }]);
        }
      }
      setPendingContact(null);
      setContactInput("");
    } catch {
      setContactError(true);
    } finally {
      setContactSubmitting(false);
    }
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
                {/* Old "Photo Portugal Concierge" badge above the first
                    message is removed: with Lens-the-AI as the named bot
                    via the nudge bubble below, two different identities
                    on the same screen reads as inconsistent. The Lens
                    label on the nudge is enough. */}
                {/* Lens nudge gets its own visual treatment: amber-tinted
                    bubble + 🤖 sparkle icon row above so the visitor knows
                    this is a friendly automated nudge, not an answer to
                    their (non-existent) question. */}
                {m.isNudge && (
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                    <span aria-hidden="true">✨</span>
                    {t("nudge.label")}
                  </div>
                )}
                {/* Skip empty assistant bubbles — happens when the AI
                    fires a tool call (handoff / matches / locations) but
                    returns no text. The action card below carries all
                    the visible meaning; an empty grey bubble next to it
                    just looks broken. */}
                {(m.role === "user" || (m.content && m.content.trim())) && (
                  <div
                    className={`inline-block rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary-600 text-white"
                        : m.isNudge
                          ? "bg-amber-50 text-gray-900 ring-1 ring-amber-200"
                          : "bg-warm-100 text-gray-900"
                    }`}
                  >
                    {m.role === "assistant"
                      ? <MarkdownText text={m.content} />
                      : /* Strip the "(slug:foo)" hint that LocationOptionCard
                           appends so the AI gets a deterministic slug while
                           the visitor only sees the human-readable name. */
                        m.content.replace(/\s*\(slug:[a-z0-9-]+\)\s*$/i, "")}
                  </div>
                )}
                {/* Example-prompt chips. Click → autofills input + auto-
                    submits as the visitor's first user message. Disabled
                    once anything else has been sent. */}
                {m.isNudge && m.nudgeChips && m.nudgeChips.length > 0 && i === messages.length - 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.nudgeChips.map((chip, ci) => (
                      <button
                        key={ci}
                        type="button"
                        onClick={() => { cancelNudgeTimer(); send(chip); }}
                        disabled={sending}
                        className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-medium text-amber-800 transition hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}

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
                          chatId={chatId}
                          // Strip the "(slug:foo)" hint that LocationOptionCard appends to
                          // user replies — those hints are AI-routing metadata, not something
                          // that should appear in a booking comment shown to the photographer.
                          chatContext={messages.filter(x => x.role === "user").slice(-3).map(x => x.content.replace(/\s*\(slug:[a-z0-9-]+\)\s*/gi, " ").trim()).filter(Boolean).join(" / ")}
                          compareSelected={compareSet.has(p.slug)}
                          onToggleCompare={() => toggleCompare(p.slug)}
                          compareDisabled={!compareSet.has(p.slug) && compareSet.size >= 3}
                        />
                      </div>
                    ))}
                    {i === messages.length - 1 && pendingContact === null && (
                      <ResendMatchesButton onClick={startEmailMatches} disabled={contactSubmitting} />
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

                {m.action?.type === "show_spots" && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {m.action.data.spots.map((sp) => (
                      <SpotOptionCard key={`${sp.city}-${sp.slug}`} sp={sp} locale={locale} />
                    ))}
                  </div>
                )}

                {m.action?.type === "human_handoff" && (
                  <HumanHandoffBox
                    chatId={chatId}
                    locale={locale}
                    summary={m.action.data.summary}
                    hasContact={!!hasContact}
                  />
                )}

                {m.action?.type === "offer_blind_booking" && (
                  <BlindBookingCard
                    offer={m.action.data}
                    locale={locale}
                    chatId={chatId}
                    onDecline={() => {
                      // Use the user's actual chat language, not the URL
                      // locale — visitors often type Russian/Ukrainian/Italian
                      // on an /en page and our forced English bubble looked
                      // glitchy. Heuristic over script ranges + fallback to
                      // the next-intl translation for the 5 site locales.
                      const lastUserMsg = [...messages].reverse().find((x) => x.role === "user");
                      const txt = lastUserMsg?.content || "";
                      const declineByScript: Record<string, string> = {
                        ru: "Вообще-то покажи мне варианты фотографов.",
                        uk: "Насправді покажи варіанти фотографів.",
                        zh: "其实，请显示摄影师选项。",
                        ja: "やっぱり、写真家の選択肢を見せてください。",
                        ko: "그냥 사진작가 옵션을 보여주세요.",
                        ar: "في الواقع، أرني خيارات المصورين.",
                        he: "בעצם, הראה לי את אפשרויות הצלמים.",
                        tr: "Aslında, fotoğrafçı seçeneklerini görmek istiyorum.",
                        it: "In realtà, mostratemi le opzioni dei fotografi.",
                        nl: "Eigenlijk wil ik liever de fotograafopties zien.",
                      };
                      let synth: string | null = null;
                      if (/[а-яА-ЯёЁ]/.test(txt)) {
                        synth = /[іїєґІЇЄҐ]/.test(txt) ? declineByScript.uk : declineByScript.ru;
                      } else if (/[一-鿿]/.test(txt)) synth = declineByScript.zh;
                      else if (/[぀-ヿ]/.test(txt)) synth = declineByScript.ja;
                      else if (/[가-힯]/.test(txt)) synth = declineByScript.ko;
                      else if (/[؀-ۿ]/.test(txt)) synth = declineByScript.ar;
                      else if (/[֐-׿]/.test(txt)) synth = declineByScript.he;
                      send(
                        synth ||
                          t("blindBookingDeclineMessage") ||
                          "Actually, let me see the photographer options instead."
                      );
                    }}
                  />
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

      {/* Post-match capture: visitor picks how they want to continue
          (Email recap or WhatsApp handoff). Step 1 = choice buttons.
          Step 2 = the relevant input. Email path is unchanged; the
          WhatsApp path saves their phone and opens wa.me with a
          summary so they land in the chat ready to send. */}
      {matchesShown && !emailCaptured && pendingContact === null && (
        <div className="border-t border-warm-100 bg-primary-50/40 px-4 py-3 sm:px-6">
          {captureMode === "choice" && (
            <div>
              <p className="mb-2 text-[13px] font-medium text-gray-700">
                {t("captureChoiceTitle")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setCaptureMode("email")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary-300 hover:bg-primary-50"
                >
                  <span aria-hidden>💌</span>{t("captureChoiceEmail")}
                </button>
                <button
                  type="button"
                  onClick={() => setCaptureMode("whatsapp")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M17.6 6.32A7.85 7.85 0 0012.05 4a7.94 7.94 0 00-6.88 11.92L4 20l4.18-1.1a7.93 7.93 0 003.86 1h.01c4.38 0 7.94-3.56 7.95-7.94a7.9 7.9 0 00-2.4-5.64zm-5.55 12.18h-.01a6.6 6.6 0 01-3.36-.92l-.24-.14-2.48.65.66-2.42-.16-.25a6.6 6.6 0 1112.21-3.5 6.6 6.6 0 01-6.62 6.58z"/></svg>
                  {t("captureChoiceWhatsapp")}
                </button>
              </div>
            </div>
          )}

          {captureMode === "email" && (
            <form onSubmit={submitEmail} className="flex items-center gap-2">
              <button type="button" onClick={() => setCaptureMode("choice")} className="shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-700" aria-label={tc("back")}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-base shrink-0" aria-hidden>💌</span>
              <input
                type="email"
                required
                autoFocus
                placeholder={t("emailPlaceholder")}
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-base sm:text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
              <button
                type="submit"
                disabled={!emailValue.includes("@") || emailSubmitting}
                className="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
              >
                {emailSubmitting ? "…" : t("saveBtn")}
              </button>
            </form>
          )}

          {captureMode === "whatsapp" && (
            <form onSubmit={submitWhatsapp} className="flex items-center gap-2">
              <button type="button" onClick={() => setCaptureMode("choice")} className="shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-700" aria-label={tc("back")}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-base shrink-0" aria-hidden>📱</span>
              <input
                type="tel"
                required
                autoFocus
                placeholder={t("phonePlaceholder")}
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-base sm:text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <button
                type="submit"
                disabled={phoneValue.replace(/\D/g, "").length < 6 || phoneSubmitting}
                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {phoneSubmitting ? "…" : t("openWhatsappBtn")}
              </button>
            </form>
          )}
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

      {/* Compare bar — shows when 2-3 cards are ticked. Floats above the
          input so the visitor can act on it whether they're scrolling
          through history or composing a new message. */}
      {compareSet.size >= 2 && (
        <div className="border-t border-warm-100 bg-primary-50 px-4 py-2 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-primary-900">
              {compareSet.size} {t("compareSelected").toLowerCase()}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCompareSet(new Set())}
                className="rounded-md px-2 py-1 text-[12px] font-medium text-gray-500 hover:bg-warm-100 hover:text-gray-700"
              >
                {t("compareClear")}
              </button>
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-primary-700"
              >
                {t("compareCta", { n: compareSet.size })}
              </button>
            </div>
          </div>
        </div>
      )}

      {compareOpen && compareList.length >= 2 && (
        <CompareModal
          photographers={compareList}
          locale={locale}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {/* Persistent "Ask a human" — visible from the second user turn so
          early-stage tyre-kickers don't get distracted. If we already
          have email/phone, click fires handoff immediately. If not, the
          bot asks for contact in-chat first; admin Telegram only fires
          AFTER the visitor leaves a way to be reached. */}
      {chatId && messages.filter(m => m.role === "user").length >= 1 && pendingContact === null && (
        <AskHumanBar onClick={startAskHuman} disabled={contactSubmitting} />
      )}

      {/* Inline contact prompt form — rendered when pendingContact is
          set. Lives above the input so it's the most-prominent next
          action after the bot's question above. */}
      {pendingContact && chatId && (
        <div className="border-t border-warm-100 bg-warm-50/40 px-4 py-3 sm:px-6">
          <form onSubmit={submitInChatContact} className="flex items-center gap-2">
            <span className="text-base shrink-0" aria-hidden>{pendingContact === "email_matches" ? "💌" : "👋"}</span>
            <input
              type="text"
              required
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              inputMode="text"
              placeholder={t("contactInputPlaceholder")}
              value={contactInput}
              onChange={(e) => { setContactInput(e.target.value); if (contactError) setContactError(false); }}
              className={`flex-1 min-w-0 rounded-lg border bg-white px-3 py-2 text-base sm:py-1.5 sm:text-sm focus:outline-none focus:ring-1 ${contactError ? "border-rose-400 focus:border-rose-500 focus:ring-rose-400" : "border-warm-200 focus:border-primary-400 focus:ring-primary-400"}`}
            />
            <button
              type="submit"
              disabled={contactSubmitting || !contactInput.trim()}
              className="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {contactSubmitting ? "…" : t("contactSubmit")}
            </button>
          </form>
          {contactError && (
            <p className="mt-1 text-[12px] text-rose-600">{t("contactInvalid")}</p>
          )}
        </div>
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
            onChange={(e) => {
              setInput(e.target.value);
              // First keystroke kills the pending nudge — they're already
              // engaged, no need to interrupt with a tutorial bubble.
              if (e.target.value.length > 0) cancelNudgeTimer();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={t("inputPlaceholder")}
            className="flex-1 resize-none rounded-xl border border-warm-200 bg-white px-3.5 py-2.5 text-base sm:text-[15px] focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
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

function SpotOptionCard({ sp, locale }: { sp: SpotOption; locale: string }) {
  const displayName =
    (locale === "pt" && sp.name_pt) ||
    (locale === "de" && sp.name_de) ||
    (locale === "es" && sp.name_es) ||
    (locale === "fr" && sp.name_fr) ||
    sp.name;
  // Spots open the dedicated spot page — unlike LocationOptionCard which
  // feeds the slug back into the chat. Spots are deeper destinations: the
  // visitor wants to read about the place + see photographers there.
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const href = `${localePrefix}/spots/${sp.city}/${sp.slug}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative overflow-hidden rounded-xl border border-warm-200 bg-white text-left transition hover:border-primary-300 hover:shadow-md"
    >
      {sp.cover_image ? (
        <div className="aspect-[16/9] w-full overflow-hidden bg-warm-100">
          <OptimizedImage src={sp.cover_image} alt={displayName} width={400} className="h-full w-full transition group-hover:scale-[1.02]" />
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-primary-50 to-warm-100 text-primary-300">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-bold text-gray-900">{displayName}</p>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-gray-600">{sp.reason}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600">
          Open spot
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </span>
      </div>
    </a>
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
      // Send "Display name (slug:foo)" — display name keeps the
      // conversation natural in the user's language, the trailing
      // (slug:...) hint locks the AI onto the correct coverage slug
      // so e.g. "São Miguel" doesn't get matched to a generic Azores
      // photographer when the visitor wanted that specific island.
      onClick={() => onPick(`${displayName} (slug:${loc.slug})`)}
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

function AskHumanBar({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const t = useTranslations("concierge");
  return (
    <div className="border-t border-warm-100 bg-warm-50/40 px-4 py-1.5 sm:px-6">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-1 text-[12px] font-medium text-gray-500 transition hover:bg-warm-100 hover:text-primary-600 disabled:opacity-50"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {t("askHumanCta")}
      </button>
    </div>
  );
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

function PhotographerMatchCard({ p, locale, chatContext, chatId, compareSelected, onToggleCompare, compareDisabled }: { p: MatchPhotographer; locale: string; chatContext: string; chatId: string | null; compareSelected?: boolean; onToggleCompare?: () => void; compareDisabled?: boolean }) {
  // Fire-and-forget click beacon — drives the click_through funnel
  // metric on concierge_recommendation_events. Uses sendBeacon when
  // available so it survives navigation away from the page.
  const trackClick = () => {
    if (!chatId || !p.id) return;
    try {
      const body = JSON.stringify({ chat_id: chatId, photographer_id: p.id });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/concierge/recommendation-click", blob);
        return;
      }
      fetch("/api/concierge/recommendation-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };
  const t = useTranslations("concierge");
  const firstName = p.name.split(" ")[0];
  const presence = presenceBadge(p.last_seen_at, t);
  const prefill = chatContext
    ? encodeURIComponent(`${t("prefillIntro")}\n\n${chatContext}`.slice(0, 1000))
    : "";
  const bookHref = `/${locale}/book/${p.slug}?from=concierge${prefill ? `&prefill_message=${prefill}` : ""}`;
  const locationLabel = p.locations.slice(0, 2).map(l => l.charAt(0).toUpperCase() + l.slice(1).replace(/-/g, " ")).join(" · ");

  // Build the slider thumbnails: cover first, then up to 7 portfolio photos.
  // Visitors live in chat — letting them swipe through 8 shots without opening
  // a profile is the whole point. Lightbox launches on tap (click on image).
  const thumbs: string[] = [];
  if (p.cover_url) thumbs.push(p.cover_url);
  for (const u of p.portfolio_thumbs ?? []) {
    if (u && !thumbs.includes(u)) thumbs.push(u);
    if (thumbs.length >= 8) break;
  }
  if (thumbs.length === 0) {
    const fallback = p.sample_portfolio_url || p.avatar_url;
    if (fallback) thumbs.push(fallback);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-warm-200 bg-white">
      {thumbs.length > 0 && (
        <div className="relative">
          <PhotographerCardCover
            slug={p.slug}
            name={p.name}
            thumbnails={thumbs}
            coverPositionY={p.cover_position_y ?? null}
            height="aspect-[5/3] h-auto"
            altPrefix={`${p.name} portfolio`}
            impressionSurface="concierge"
          />
          {presence && (
            <span className="pointer-events-none absolute left-2 top-2 z-20 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm backdrop-blur-sm">
              <span className={`h-1.5 w-1.5 rounded-full ${presence.color}`} />
              {presence.label}
            </span>
          )}
          {onToggleCompare && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!compareDisabled || compareSelected) onToggleCompare(); }}
              disabled={compareDisabled && !compareSelected}
              aria-pressed={compareSelected}
              className={`absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm backdrop-blur-sm ring-1 transition disabled:opacity-50 ${
                compareSelected
                  ? "bg-primary-600 text-white ring-primary-600"
                  : "bg-white/90 text-gray-700 ring-warm-200 hover:bg-white"
              }`}
            >
              <span aria-hidden className={`flex h-3.5 w-3.5 items-center justify-center rounded ${compareSelected ? "bg-white text-primary-600" : "border border-gray-400"}`}>
                {compareSelected ? (
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : null}
              </span>
              {compareSelected ? t("compareSelected") : t("compareToggle")}
            </button>
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
        {(p.style_label || (p.badges && p.badges.length > 0) || p.availability) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {p.availability && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                  p.availability.available
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-rose-50 text-rose-700 ring-rose-200"
                }`}
              >
                {p.availability.available ? "✓" : "⚠"} {p.availability.label}
              </span>
            )}
            {p.style_label && (
              <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700 ring-1 ring-primary-100">
                {p.style_label}
              </span>
            )}
            {p.badges?.map((b) => (
              <span
                key={b.type}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                  b.type === "best_match"
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : b.type === "fastest_responder"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : b.type === "most_reviews"
                    ? "bg-sky-50 text-sky-700 ring-sky-200"
                    : b.type === "best_value"
                    ? "bg-rose-50 text-rose-700 ring-rose-200"
                    : "bg-warm-100 text-gray-700 ring-warm-200"
                }`}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}
        {p.sample_review?.text && (
          <blockquote className="mt-2 border-l-2 border-warm-200 pl-2 text-[12px] italic leading-snug text-gray-600">
            &ldquo;{p.sample_review.text.slice(0, 140)}{p.sample_review.text.length > 140 ? "…" : ""}&rdquo;
            {p.sample_review.client_name && (
              <span className="ml-1 not-italic text-[11px] font-medium text-gray-400">— {p.sample_review.client_name}</span>
            )}
          </blockquote>
        )}
      </div>
      <div className="flex items-stretch border-t border-warm-100">
        <a
          href={`/${locale}/photographers/${p.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={trackClick}
          className="flex-1 px-3 py-2 text-center text-[13px] font-medium text-gray-600 transition hover:bg-warm-50"
        >
          {t("viewProfile")}
        </a>
        <a
          href={bookHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={trackClick}
          className="flex-1 border-l border-warm-100 bg-primary-600 px-3 py-2 text-center text-[13px] font-semibold text-white transition hover:bg-primary-700"
        >
          {t("talkTo", { name: firstName })}
        </a>
      </div>
    </div>
  );
}

function ResendMatchesButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const t = useTranslations("concierge");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-1 w-full rounded-lg border border-dashed border-warm-300 bg-warm-50 px-3 py-2 text-center text-xs font-medium text-gray-600 transition hover:bg-warm-100 hover:text-primary-700 disabled:opacity-50"
    >
      {t("emailMeThese")}
    </button>
  );
}

function CompareModal({
  photographers,
  locale,
  onClose,
}: {
  photographers: MatchPhotographer[];
  locale: string;
  onClose: () => void;
}) {
  const t = useTranslations("concierge");
  const tc = useTranslations("common");

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-w-4xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-warm-100 px-4 py-3 sm:px-6">
          <h2 className="text-base font-bold text-gray-900">{t("compareModalTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-warm-100 hover:text-gray-800"
            aria-label={tc("dismiss")}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className={`grid gap-3 ${photographers.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
            {photographers.map((p) => (
              <CompareColumn key={p.slug} p={p} locale={locale} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareColumn({ p, locale }: { p: MatchPhotographer; locale: string }) {
  const t = useTranslations("concierge");
  const firstName = p.name.split(" ")[0];
  const cover = p.cover_url || p.sample_portfolio_url || p.avatar_url;
  const locs = p.locations.slice(0, 3).map((l) => l.charAt(0).toUpperCase() + l.slice(1).replace(/-/g, " ")).join(", ");
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-warm-200 bg-white">
      {cover && (
        <div className="aspect-[5/4] w-full overflow-hidden bg-warm-100">
          <OptimizedImage src={cover} alt={p.name} width={400} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-3 text-[12px]">
        <div>
          <p className="text-[14px] font-bold text-gray-900">{p.name}</p>
          {p.review_count > 0 ? (
            <p className="text-[12px] font-semibold text-gray-700">⭐ {p.rating.toFixed(1)} <span className="font-medium text-gray-500">({p.review_count})</span></p>
          ) : (
            <p className="text-[11px] font-medium text-amber-600">{t("newBadge")}</p>
          )}
        </div>

        {p.availability && (
          <span
            className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
              p.availability.available
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-rose-50 text-rose-700 ring-rose-200"
            }`}
          >
            {p.availability.available ? "✓" : "⚠"} {p.availability.label}
          </span>
        )}

        {p.style_label && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("compareStyle")}</p>
            <p className="text-gray-800">{p.style_label}</p>
          </div>
        )}

        {p.badges && p.badges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {p.badges.map((b) => (
              <span key={b.type} className="inline-flex items-center rounded-full bg-warm-100 px-2 py-0.5 text-[10px] font-medium text-gray-700 ring-1 ring-warm-200">
                {b.label}
              </span>
            ))}
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("compareLocations")}</p>
          <p className="text-gray-800">{locs || t("compareNoData")}</p>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("comparePrice")}</p>
          <p className="text-gray-800">{p.min_price ? `€${p.min_price}+` : t("compareNoData")}</p>
        </div>

        {p.reasoning && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("compareWhyMatch")}</p>
            <p className="leading-snug text-gray-700">{p.reasoning}</p>
          </div>
        )}

        {p.sample_review?.text && (
          <blockquote className="border-l-2 border-warm-200 pl-2 italic leading-snug text-gray-600">
            &ldquo;{p.sample_review.text.slice(0, 120)}{p.sample_review.text.length > 120 ? "…" : ""}&rdquo;
          </blockquote>
        )}
      </div>
      <div className="flex items-stretch border-t border-warm-100">
        <a
          href={`/${locale}/photographers/${p.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 px-2 py-2 text-center text-[12px] font-medium text-gray-600 transition hover:bg-warm-50"
        >
          {t("viewProfile")}
        </a>
        <a
          href={`/${locale}/book/${p.slug}?from=concierge`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 border-l border-warm-100 bg-primary-600 px-2 py-2 text-center text-[12px] font-semibold text-white transition hover:bg-primary-700"
        >
          {t("talkTo", { name: firstName })}
        </a>
      </div>
    </div>
  );
}

// Compact contact-capture card that appears under an AI handoff message.
// Single input — accepts a WhatsApp / phone number OR an email. We
// auto-detect which one the visitor typed. Layout stacks vertically so
// it fits the chat sidebar width without overflow.
//
// `hasContact` lets the parent skip rendering this entirely when the AI
// already captured contact info on a previous turn (most common case
// now that the prompt forces it). Card only shows as a fallback.
function HumanHandoffBox({ chatId, summary, hasContact }: { chatId: string | null; locale: string; summary: string; hasContact?: boolean }) {
  const t = useTranslations("concierge");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (hasContact) return null; // AI captured it already

  const trimmed = contact.trim();
  const looksLikeEmail = trimmed.includes("@") && trimmed.includes(".");
  const digits = trimmed.replace(/\D/g, "");
  const looksLikePhone = !looksLikeEmail && digits.length >= 6;
  const valid = looksLikeEmail || looksLikePhone;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatId || !valid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/concierge/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          summary,
          ...(looksLikeEmail ? { email: trimmed } : { phone: trimmed }),
        }),
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
    <form onSubmit={submit} className="mt-3 space-y-2.5 rounded-xl border border-warm-200 bg-warm-50 p-4">
      <p className="text-sm text-gray-700">{t("handoffPromptPhone") || t("handoffPrompt")}</p>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        placeholder={t("handoffContactPlaceholder") || "WhatsApp number or email"}
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
      />
      <button
        type="submit"
        disabled={!valid || submitting}
        className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
      >
        {submitting ? t("handoffSendingBtn") : t("handoffSubmitBtn")}
      </button>
    </form>
  );
}

interface BlindOffer {
  hold_id: string;
  region: string;
  slug: string;
  date: string;
  occasion: string;
  party_size: number;
  duration_minutes: number;
  // price_eur is the ALL-INCLUSIVE summer-offer total the client pays
  // (regional inclusive price × 9+-group multiplier) — charged straight.
  price_eur: number;
  regional_base_eur?: number;
  // Pre-offer all-in total for the strike-through ("was €344") + saving.
  compare_at_eur?: number;
  savings_eur?: number;
  large_group_applied?: boolean;
  sample_size: number;
  reply_text: string;
}

function BlindBookingCard({
  offer,
  locale,
  chatId,
  onDecline,
}: {
  offer: BlindOffer;
  locale: string;
  chatId: string | null;
  onDecline: () => void;
}) {
  const t = useTranslations("concierge");
  const [stage, setStage] = useState<"offer" | "form" | "submitting" | "redirecting">("offer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);

  const regionLabel = offer.region
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
  const occasionLabel = offer.occasion.charAt(0).toUpperCase() + offer.occasion.slice(1);
  const durationLabel = `${offer.duration_minutes < 60 ? offer.duration_minutes + " min" : offer.duration_minutes / 60 + "h"}`;

  const dateLabel = (() => {
    try {
      return new Date(offer.date + "T12:00:00").toLocaleDateString(locale === "en" ? "en-GB" : locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return offer.date;
    }
  })();

  const validForm =
    !!name.trim() &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) &&
    phone.replace(/\D/g, "").length >= 6;

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!validForm) return;
    setStage("submitting");
    setError(null);
    try {
      const res = await fetch("/api/concierge/blind-booking/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hold_id: offer.hold_id,
          chat_id: chatId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          meeting_hint: hint.trim(),
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.checkout_url) {
        setStage("form");
        setError(data?.error || t("blindBookingError") || "Could not process your booking. Please try again.");
        return;
      }
      setStage("redirecting");
      window.location.href = data.checkout_url;
    } catch {
      setStage("form");
      setError(t("blindBookingError") || "Could not process your booking. Please try again.");
    }
  }

  if (stage === "offer") {
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white shadow-sm">
        <div className="border-b border-amber-200 bg-amber-100/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
          {t("blindBookingBadge") || "Concierge offer"}
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t("blindBookingRegion") || "Region"}</p>
              <p className="font-semibold text-gray-900">{regionLabel}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t("blindBookingDate") || "Date"}</p>
              <p className="font-semibold text-gray-900">{dateLabel}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t("blindBookingOccasion") || "Occasion"}</p>
              <p className="font-semibold text-gray-900">
                {occasionLabel} · {offer.party_size} {offer.party_size === 1 ? "person" : "people"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t("blindBookingDuration") || "Duration"}</p>
              <p className="font-semibold text-gray-900">{durationLabel}</p>
            </div>
          </div>

          <div className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-amber-200">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">{t("blindBookingSummerOffer")}</p>
            <p className="text-2xl font-bold text-gray-900">
              €{offer.price_eur}
              {offer.compare_at_eur && offer.compare_at_eur > offer.price_eur ? (
                <span className="ml-2 align-middle text-base font-medium text-gray-400 line-through">€{offer.compare_at_eur}</span>
              ) : null}
            </p>
            {offer.savings_eur && offer.savings_eur > 0 ? (
              <p className="mt-0.5 text-[12px] font-semibold text-green-700">
                {t("blindBookingSave", { amount: offer.savings_eur })}
              </p>
            ) : null}
            <p className="mt-0.5 text-[11px] text-gray-500">{t("blindBookingAllIn")}</p>
            <p className="mt-1 text-[11px] text-gray-500">
              {t("blindBookingHoldNote") || "Authorised now — charged only when your photographer is confirmed within 24h. Auto-refund if we can't match."}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setStage("form")}
              className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              {t("blindBookingYes") || "Yes, book it"}
            </button>
            <button
              type="button"
              onClick={onDecline}
              className="flex-1 rounded-lg border border-warm-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-warm-50"
            >
              {t("blindBookingNo") || "Show photographers"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Inline form (after Yes) — re-shows the offer summary above the
  // fields so the price + scope stay visible at the moment of consent
  // (audit finding #12). Without this, "I never saw €280" disputes
  // become plausible when the user hits Stripe Checkout.
  return (
    <form onSubmit={submitForm} className="mt-3 space-y-2 rounded-2xl border border-amber-300 bg-white p-4 shadow-sm">
      <div className="rounded-lg bg-amber-50/70 px-3 py-2 ring-1 ring-amber-200">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
          {t("blindBookingBadge") || "Concierge offer"}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-gray-900">
          {regionLabel} · {dateLabel} · {occasionLabel} · {offer.party_size}{" "}
          {offer.party_size === 1 ? "person" : "people"} · {durationLabel}
        </p>
        <p className="mt-1 text-base font-bold text-gray-900">
          €{offer.price_eur}
          {offer.compare_at_eur && offer.compare_at_eur > offer.price_eur ? (
            <span className="ml-1.5 align-middle text-xs font-medium text-gray-400 line-through">€{offer.compare_at_eur}</span>
          ) : null}
        </p>
        <p className="text-[10px] text-gray-500">{t("blindBookingAllIn")}</p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          {t("blindBookingHoldNote") || "Authorised now — charged only when your photographer is confirmed within 24h. Auto-refund if we can't match."}
        </p>
      </div>
      <p className="text-xs text-gray-600">
        {t("blindBookingFormIntro") || "Two quick details so we can confirm by tomorrow."}
      </p>
      <input
        type="text"
        required
        placeholder={t("blindBookingName") || "Your name"}
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
      <input
        type="email"
        required
        placeholder={t("blindBookingEmail") || "Email"}
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
      <input
        type="tel"
        required
        placeholder={t("blindBookingPhone") || "WhatsApp / phone for the day"}
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
      <input
        type="text"
        placeholder={t("blindBookingHint") || "Meeting hint (optional)"}
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-base focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!validForm || stage === "submitting" || stage === "redirecting"}
        className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
      >
        {stage === "submitting"
          ? t("blindBookingProcessing") || "Processing..."
          : stage === "redirecting"
          ? t("blindBookingRedirecting") || "Opening checkout..."
          : t("blindBookingProceed") || "Continue to secure checkout"}
      </button>
    </form>
  );
}

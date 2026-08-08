"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { DeliveryGalleryClient } from "./DeliveryGalleryClient";
import { Avatar } from "@/components/ui/Avatar";
import { DisputeForm } from "@/components/ui/DisputeForm";
import { trackDeliveryAccepted } from "@/lib/analytics";
import { normalizeName } from "@/lib/format-name";
import { useConfirmModal } from "@/components/ui/ConfirmModal";
import { useSession } from "next-auth/react";
import { country } from "@/lib/country";

const FILES_HOST = country.filesHost;

interface Photo {
  id: string;
  url: string;
  filename: string;
  file_size: number;
  thumbnail_url?: string | null;
  preview_url?: string | null;
  media_type?: "image" | "video";
  duration_seconds?: number | null;
  width?: number | null;
  height?: number | null;
  locked?: boolean;
}

interface GalleryData {
  booking_id: string;
  client_id: string;
  photographer_name: string;
  photographer_avatar: string | null;
  client_name: string;
  shoot_date: string | null;
  photos: Photo[];
  photo_count: number;
  expires_at: string;
  auto_accept_at?: string | null;
  delivery_accepted: boolean;
  payment_status: string;
  zip_ready?: boolean;
  zip_size?: number | null;
  extras_zip_ready?: boolean;
  extras_zip_size?: number | null;
  extras_owned?: number;
  package_photos?: number;
  gifted_photos?: number;
  extras_price_cents?: number;
  gift_remaining?: number;
  extras_available?: number;
  /** A paid tip already exists for this booking — hide the tip card. */
  tipped?: boolean;
  /** Paid booking with no open dispute — the tip card may render. */
  tip_allowed?: boolean;
}

export function DeliveryPageClient({
  token,
  photographerName,
  photographerAvatar,
  deliveryTitle,
  deliveryMessage,
}: {
  token: string;
  photographerName: string;
  photographerAvatar: string | null;
  deliveryTitle?: string | null;
  deliveryMessage?: string | null;
}) {
  const t = useTranslations("delivery");
  const locale = useLocale();
  // "€5.80" was being printed into Portuguese, German, Spanish and French
  // galleries whose every other price reads "5,80 €". The locale knows where
  // the symbol goes; nothing here should be deciding that.
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
  const { data: session } = useSession();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(true);
  const [error, setError] = useState("");
  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [accepting, setAccepting] = useState(false);
  // Default on, as asked. See the note in the accept route about what that means.
  const [socialConsent, setSocialConsent] = useState(true);
  // Set when a rail counter is tapped: tells the gallery to render as far as
  // that section before the scroll starts, so the anchor stops moving.
  const [revealFor, setRevealFor] = useState<{ target: string } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState("");
  const { modal, confirm, notify } = useConfirmModal();
  // Tip card state. `tipJustSent` covers the redirect back from Stripe
  // (?tip=success) before the webhook lands; `tipDismissed` remembers
  // "maybe later" per booking on this device.
  const [tipJustSent, setTipJustSent] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("tip") === "success") setTipJustSent(true);
    } catch {}
  }, []);
  useEffect(() => {
    if (!gallery?.booking_id) return;
    try {
      if (localStorage.getItem(`tip_dismissed_${gallery.booking_id}`)) setTipDismissed(true);
    } catch {}
  }, [gallery?.booking_id]);

  // Auto-login with URL param, cached password, admin bypass, OR a
  // signed-in session for the booking's gift recipient. Gift recipients
  // never see a password — they got here from /dashboard/bookings, and
  // the verify endpoint accepts an empty body when the session user
  // matches gift_recipient_user_id.
  // Photos the client has ticked to buy. Kept in sessionStorage because a
  // cancelled Checkout comes back as a full page load: without this the
  // basket is silently emptied and they have to find every photo again.
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [buyingExtras, setBuyingExtras] = useState(false);
  const [takingAll, setTakingAll] = useState(false);
  const extrasKey = `delivery_extras_${token}`;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(extrasKey);
      if (!raw) return;
      const saved = new Set(JSON.parse(raw) as string[]);
      const stillLocked = new Set((gallery?.photos ?? []).filter((ph) => ph.locked).map((ph) => ph.id));
      // Only prune once the gallery is loaded, otherwise the basket is wiped
      // before there is anything to compare it against.
      const next = gallery ? new Set([...saved].filter((id) => stillLocked.has(id))) : saved;
      setSelectedExtras(next);
      if (gallery) {
        if (next.size === 0) sessionStorage.removeItem(extrasKey);
        else sessionStorage.setItem(extrasKey, JSON.stringify([...next]));
      }
    } catch { /* a corrupt basket is not worth an error screen */ }
  }, [extrasKey, gallery]);

  function toggleExtra(id: string) {
    // While the photographer's gift has slots left, a tap IS the redemption:
    // one photo, immediately, no basket and no ambiguity about which ones.
    if ((gallery?.gift_remaining ?? 0) > 0) {
      void redeemGift(id);
      return;
    }
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { sessionStorage.setItem(extrasKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  const [redeeming, setRedeeming] = useState<string | null>(null);

  async function redeemGift(id: string) {
    if (redeeming) return;
    setRedeeming(id);
    try {
      const pw = password || sessionStorage.getItem(`delivery_pw_${token}`) || "";
      const res = await fetch(`/api/delivery/${token}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gift: true, photo_ids: [id], password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { void notify(data?.error || t("extrasError")); return; }
      const again = await fetch(`/api/delivery/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (again.ok) setGallery(await again.json());
    } catch {
      void notify(t("extrasError"));
    } finally {
      setRedeeming(null);
    }
  }

  // The photographer sets HOW MANY photos the package holds; the client picks
  // WHICH. The server does it as one count-preserving swap, so nothing here
  // needs to reason about the promise — it just re-reads the result.
  async function swapPhoto(inId: string, outId: string): Promise<boolean> {
    const pw = password || sessionStorage.getItem(`delivery_pw_${token}`) || "";
    try {
      const res = await fetch(`/api/delivery/${token}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ in: inId, out: outId, password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { void notify(data?.error || t("extrasError")); return false; }
      const again = await fetch(`/api/delivery/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (again.ok) setGallery(await again.json());
      return true;
    } catch {
      void notify(t("extrasError"));
      return false;
    }
  }

  // A photographer who shot 500 against a promise of 400 and gifted the
  // difference should not be sending their client on a hundred taps. One
  // button: the free part is redeemed in a single call, the rest lands in the
  // basket with its total showing — which is also the moment a client decides
  // the remainder is worth paying for.
  async function takeAllExtras() {
    if (takingAll) return;
    const locked = (gallery?.photos ?? []).filter((p) => p.locked).map((p) => p.id);
    if (locked.length === 0) return;
    const freeCount = Math.min(gallery?.gift_remaining ?? 0, locked.length);
    const freeIds = locked.slice(0, freeCount);
    const paidIds = locked.slice(freeCount);

    const ok = await confirm(
      t("takeAllTitle"),
      freeCount > 0 && paidIds.length > 0
        ? t("takeAllMixed", { free: freeCount, paid: paidIds.length, total: money(paidIds.length * (gallery?.extras_price_cents ?? 290)) })
        : freeCount > 0
          ? t("takeAllFree", { count: freeCount })
          : t("takeAllPaid", { count: paidIds.length, total: money(paidIds.length * (gallery?.extras_price_cents ?? 290)) }),
      { confirmLabel: t("takeAllConfirm") }
    );
    if (!ok) return;

    setTakingAll(true);
    const pw = password || sessionStorage.getItem(`delivery_pw_${token}`) || "";
    try {
      if (freeIds.length > 0) {
        const res = await fetch(`/api/delivery/${token}/extras`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gift: true, photo_ids: freeIds, password: pw }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          void notify(data?.error || t("extrasError"));
          return;
        }
        const again = await fetch(`/api/delivery/${token}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pw }),
        });
        if (again.ok) setGallery(await again.json());
      }
      // The paid remainder is a basket, not a charge — they still press Buy.
      if (paidIds.length > 0) {
        setSelectedExtras(new Set(paidIds));
        try { sessionStorage.setItem(extrasKey, JSON.stringify(paidIds)); } catch {}
      }
    } catch {
      void notify(t("extrasError"));
    } finally {
      setTakingAll(false);
    }
  }

  async function takeFreeOnly() {
    if (takingAll) return;
    const locked = (gallery?.photos ?? []).filter((p) => p.locked).map((p) => p.id);
    const freeIds = locked.slice(0, Math.min(gallery?.gift_remaining ?? 0, locked.length));
    if (freeIds.length === 0) return;
    setTakingAll(true);
    const pw = password || sessionStorage.getItem(`delivery_pw_${token}`) || "";
    try {
      const res = await fetch(`/api/delivery/${token}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gift: true, photo_ids: freeIds, password: pw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        void notify(data?.error || t("extrasError"));
        return;
      }
      const again = await fetch(`/api/delivery/${token}/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (again.ok) setGallery(await again.json());
    } catch {
      void notify(t("extrasError"));
    } finally {
      setTakingAll(false);
    }
  }

  async function ungiftPhoto(id: string) {
    if (redeeming) return;
    setRedeeming(id);
    try {
      const pw = password || sessionStorage.getItem(`delivery_pw_${token}`) || "";
      const res = await fetch(`/api/delivery/${token}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ungift: id, password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { void notify(data?.error || t("extrasError")); return; }
      const again = await fetch(`/api/delivery/${token}/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (again.ok) setGallery(await again.json());
    } catch {
      void notify(t("extrasError"));
    } finally {
      setRedeeming(null);
    }
  }

  async function reorderPhotos(ids: string[]) {
    const pw = password || sessionStorage.getItem(`delivery_pw_${token}`) || "";
    try {
      const res = await fetch(`/api/delivery/${token}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: ids, password: pw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        void notify(data?.error || t("extrasError"));
        return;
      }
      const again = await fetch(`/api/delivery/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (again.ok) setGallery(await again.json());
    } catch {
      void notify(t("extrasError"));
    }
  }

  async function buyExtras() {
    if (selectedExtras.size === 0 || buyingExtras) return;
    setBuyingExtras(true);
    try {
      const pw = password || sessionStorage.getItem(`delivery_pw_${token}`) || "";
      const ids = [...selectedExtras];

      // Everything in the basket is covered by the gift — redeem, do not
      // charge. Reachable because the photographer can raise the gift after
      // the basket was filled, and the basket survives in sessionStorage.
      if (ids.length <= (gallery?.gift_remaining ?? 0)) {
        const res = await fetch(`/api/delivery/${token}/extras`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gift: true, photo_ids: ids, password: pw }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { void notify(data?.error || t("extrasError")); setBuyingExtras(false); return; }
        setSelectedExtras(new Set());
        try { sessionStorage.removeItem(extrasKey); } catch {}
        const again = await fetch(`/api/delivery/${token}/verify`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pw }),
        });
        if (again.ok) setGallery(await again.json());
        setBuyingExtras(false);
        return;
      }


      const res = await fetch(`/api/delivery/${token}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_ids: ids, password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        void notify(data?.error || t("extrasError"));
        setBuyingExtras(false);
        return;
      }
      if (typeof data.photos === "number" && data.photos < ids.length) {
        void notify(t("extrasSomeGone", { count: ids.length - data.photos }));
        setBuyingExtras(false);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      void notify(err instanceof Error ? err.message : String(err));
      setBuyingExtras(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPw = params.get("pw");
    const adminBypass = params.get("admin") === "1";
    const cached = urlPw || sessionStorage.getItem(`delivery_pw_${token}`);
    if (urlPw) sessionStorage.setItem(`delivery_pw_${token}`, urlPw);
    // Always try once — verify will succeed for admins and signed-in
    // gift recipients even with an empty password. If it fails, we fall
    // back to the password prompt.
    fetch(`/api/delivery/${token}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: cached || "" }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setGallery(data);
          if (data.delivery_accepted) setAccepted(true);
          // Back from Stripe: the photos just bought are no longer locked in
          // this payload, so the basket is spent. On a cancelled checkout the
          // selection is deliberately left alone.
          if (params.get("extras") === "success") {
            setSelectedExtras(new Set());
            try { sessionStorage.removeItem(extrasKey); } catch {}
            // The redirect from Stripe regularly beats the webhook by a second
            // or two, so the first read still shows everything locked. Re-read
            // a few times rather than leaving the buyer looking at photos they
            // have just paid for, still behind a watermark.
            let tries = 0;
            const settle = setInterval(async () => {
              tries += 1;
              try {
                const again = await fetch(`/api/delivery/${token}/verify`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password: cached || "" }),
                });
                if (again.ok) {
                  const fresh = await again.json();
                  if ((fresh.extras_owned ?? 0) > (data.extras_owned ?? 0)) {
                    setGallery(fresh);
                    clearInterval(settle);
                    return;
                  }
                }
              } catch { /* keep trying until the attempt budget runs out */ }
              if (tries >= 10) clearInterval(settle);
            }, 3000);
          }
        }
        setAutoLoading(false);
      })
      .catch(() => setAutoLoading(false));
    void adminBypass; // legacy flag kept for compat; bypass is server-side
  }, [token]);

  // Poll for ZIP readiness after accept
  useEffect(() => {
    // Only worth polling for once the archive can actually exist and be shown.
    const extrasPending = accepted && (gallery?.extras_owned ?? 0) > 0 && !gallery?.extras_zip_ready;
    if (!gallery) return;
    if (!extrasPending && (!accepted || gallery.zip_ready)) return;
    const pw = password || sessionStorage.getItem(`delivery_pw_${token}`) || "";
    if (!pw) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/delivery/${token}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pw }),
        });
        if (res.ok) {
          const data = await res.json();
          // Stop when whatever we were waiting for has arrived. Before this
          // the only exit was the delivery archive, so a client who bought
          // extras without accepting polled every five seconds for as long as
          // the tab stayed open — the delivery archive is not built until
          // acceptance and would never have become ready.
          const deliveryDone = !accepted || data.zip_ready;
          const extrasDone = (data.extras_owned ?? 0) === 0 || data.extras_zip_ready;
          if (data.zip_ready || data.extras_zip_ready) setGallery(data);
          if (deliveryDone && extrasDone) clearInterval(interval);
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [accepted, gallery?.zip_ready, gallery?.extras_zip_ready, gallery?.extras_owned, token, password]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/delivery/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setGallery(data);
        if (data.delivery_accepted) setAccepted(true);
        sessionStorage.setItem(`delivery_pw_${token}`, password.trim());
      } else if (res.status === 401) {
        setError(t("incorrectPassword"));
      } else if (res.status === 410) {
        setError(t("galleryExpired"));
      } else if (res.status === 429) {
        setError("Too many attempts. Please wait 15 minutes and try again.");
      } else {
        setError(t("somethingWentWrong"));
      }
    } catch {
      setError(t("connectionError"));
    }
    setLoading(false);
  }

  // Jumping to the paid group used to land short of it. The grid loads in
  // batches of 40 as a sentinel enters the viewport, so the scroll itself
  // pulled more photos in ABOVE the target and pushed it further down while
  // the browser was still animating towards where it used to be.
  //
  // Two parts: ask the gallery to render down to the target first, then keep
  // correcting for a moment while images settle into their real heights.
  function scrollToSection(id: string) {
    setRevealFor({ target: id });

    const target = () => document.getElementById(id);
    const settle = (deadline: number) => {
      const el = target();
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      // 96px = the targets' `scroll-mt-24`, so correcting lands exactly where
      // scrollIntoView meant to. Within a few pixels of it, stop correcting.
      if (Math.abs(top - 96) > 4) {
        window.scrollTo({ top: window.scrollY + top - 96, behavior: "auto" });
      }
      if (performance.now() < deadline) requestAnimationFrame(() => settle(deadline));
    };

    requestAnimationFrame(() => {
      target()?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Long enough to cover the reveal plus a batch of images decoding.
      window.setTimeout(() => settle(performance.now() + 1200), 350);
    });
  }

  async function handleAcceptDelivery() {
    // Use existing translation keys (acceptDelivery / accept). next-intl
    // returns the key itself when missing, not a falsy value, so the old
    // `t("foo") || "fallback"` pattern showed the literal "delivery.foo"
    // when keys didn't exist.
    const giftsLeft = gallery?.gift_remaining ?? 0;
    if (giftsLeft > 0) {
      const takeFirst = await confirm(
        t("acceptGiftsLeftTitle", { count: giftsLeft }),
        t("acceptGiftsLeftBody", {
          count: giftsLeft,
          name: normalizeName(gallery?.photographer_name ?? "").split(" ")[0],
        }),
        { confirmLabel: t("acceptGiftsTakeFirst"), cancelLabel: t("acceptAnyway") }
      );
      // Confirm is the safe path here, not the destructive one: it takes the
      // free photos. Cancel is the deliberate "accept without them".
      if (takeFirst) { void takeFreeOnly(); return; }
    }

    const ok = await confirm(t("acceptDelivery"), t("confirmAcceptDelivery"), { confirmLabel: t("accept") });
    if (!ok) return;

    setAccepting(true);
    setAcceptError("");

    try {
      const cachedPw = sessionStorage.getItem(`delivery_pw_${token}`) || "";
      const res = await fetch(`/api/delivery/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() || cachedPw, socialConsent }),
      });

      if (res.ok) {
        setAccepted(true);
        trackDeliveryAccepted();
        // Re-fetch gallery to get full-res URLs now that delivery is accepted
        try {
          const pw = password.trim() || sessionStorage.getItem(`delivery_pw_${token}`) || "";
          const verifyRes = await fetch(`/api/delivery/${token}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: pw }),
          });
          if (verifyRes.ok) {
            const updatedData = await verifyRes.json();
            setGallery(updatedData);
          }
        } catch {
          // Gallery will still show preview URLs but that's acceptable
        }
      } else {
        const data = await res.json();
        if (data.already_accepted) {
          setAccepted(true);
        } else {
          setAcceptError(data.error || t("failedAcceptDelivery"));
        }
      }
    } catch {
      setAcceptError(t("connectionError"));
    }
    setAccepting(false);
  }

  // Loading cached password
  if (autoLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  // Password gate
  if (!gallery) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <Avatar src={photographerAvatar} fallback={normalizeName(photographerName)} size="lg" className="mx-auto" />
            <h1 className="mt-4 font-display text-xl font-bold text-gray-900">{normalizeName(photographerName)}</h1>
            <p className="mt-1 text-sm text-gray-500">{t("sharedPhotosWithYou")}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t("enterGalleryPassword")}
            </label>
            <p className="mt-0.5 text-xs text-gray-400">
              {t("checkMessagesForPassword")}
            </p>
            <input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("galleryPasswordInputPlaceholder")}
              autoFocus
              className="mt-3 w-full rounded-xl border border-warm-200 px-4 py-3 text-center text-lg tracking-widest focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="mt-4 w-full rounded-xl bg-primary-600 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? t("verifying") : t("viewPhotos")}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            {t("brandFooter", { brand: country.brand, domain: country.host })}
          </p>
        </div>
      </div>
    );
  }

  // Gallery view (after password verified)
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  const isOwner = !!sessionUserId && sessionUserId === gallery.client_id;
  const totalSize = gallery.photos.reduce((sum, p) => sum + (p.file_size || 0), 0);
  const dateLocale = ({ pt: "pt-PT", de: "de-DE", es: "es-ES", fr: "fr-FR", en: "en-US" } as Record<string, string>)[locale] || "en-US";
  const expiresDate = new Date(gallery.expires_at).toLocaleDateString(dateLocale, {
    month: "long", day: "numeric", year: "numeric",
  });
  const autoAcceptAt = gallery.auto_accept_at ? new Date(gallery.auto_accept_at) : null;
  const autoAcceptDate = autoAcceptAt
    ? autoAcceptAt.toLocaleDateString(dateLocale, { month: "long", day: "numeric" })
    : "";
  // Never negative and never zero-and-still-showing: the cron runs hourly, so a
  // gallery can sit a little past its own deadline.
  const daysLeft = autoAcceptAt
    ? Math.max(0, Math.ceil((autoAcceptAt.getTime() - Date.now()) / 86_400_000))
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">

      {/* Two columns, and nothing spans both. The old page was four full-width
          cards stacked above the photographs, all shouting at one volume. The
          rail carries who, how many, what state and every action; the column
          beside it is photographs and nothing else. Sticky, so the basket and
          the primary action are on screen at photo 400 exactly as at photo 1. */}
      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
        <aside className="mt-6 space-y-4 lg:sticky lg:top-20 lg:self-start">

          {/* Two counters side by side rather than stacked: they are the same
              kind of fact and the comparison is the point. Each is a real
              control — a bordered tile with an arrow badge — because the plain
              number with a "↓" after the label did not read as tappable. */}
          <div className="rounded-2xl border border-warm-200 bg-white p-4">
            <div className={(gallery.extras_available ?? 0) > 0 ? "grid grid-cols-2 gap-2" : ""}>
              <button
                type="button"
                onClick={() => scrollToSection("delivery-yours")}
                className="group rounded-xl border border-warm-200 bg-warm-50/60 p-3 text-left transition hover:border-primary-300 hover:bg-primary-50/50 active:scale-[0.98]"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-display text-2xl font-bold leading-none text-gray-900">
                    {gallery.photo_count - (gallery.extras_available ?? 0)}
                  </span>
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] text-gray-500 ring-1 ring-warm-200 transition group-hover:bg-primary-600 group-hover:text-white group-hover:ring-primary-600" aria-hidden="true">↓</span>
                </span>
                <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 group-hover:text-primary-700">
                  {t("railYours")}
                </span>
                <span className="mt-0.5 block text-[10px] text-gray-400">
                  {totalSize > 1024 * 1024
                    ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
                    : `${(totalSize / 1024).toFixed(0)} KB`}
                </span>
              </button>

              {(gallery.extras_available ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => scrollToSection("delivery-extras")}
                  className="group rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-left transition hover:border-amber-400 hover:bg-amber-100/70 active:scale-[0.98]"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-display text-2xl font-bold leading-none text-amber-900">{gallery.extras_available ?? 0}</span>
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] text-amber-700 ring-1 ring-amber-200 transition group-hover:bg-amber-700 group-hover:text-white group-hover:ring-amber-700" aria-hidden="true">↓</span>
                  </span>
                  {/* "Buy" is only true once the gift is spent — until then some
                      of these are free, and the label must not say otherwise. */}
                  <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    {(gallery?.gift_remaining ?? 0) > 0 ? t("railCanAdd") : t("railCanBuy")}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-amber-700/80">
                    {t("railEach", { price: money(gallery?.extras_price_cents ?? 290) })}
                  </span>
                </button>
              )}
            </div>

            {/* "15 yours" hid the nicest fact on the page: five were paid for
                and ten were a present. */}
            {(gallery.gifted_photos ?? 0) > 0 && (
              <p className="mt-3 text-xs leading-snug text-gray-600">
                {t("railFromPackage", { count: gallery.package_photos ?? 0 })}
                <span className="mt-0.5 block font-semibold text-accent-800">
                  🎁 {t("railFromGift", { count: gallery.gifted_photos ?? 0, name: normalizeName(gallery.photographer_name).split(" ")[0] })}
                </span>
              </p>
            )}

            {(gallery.extras_available ?? 0) > 0 && (
              <>
                {/* The only place this is explained. The price moved onto the
                    tile above, so this is now one line about how, not two. */}
                <p className="mt-3 border-t border-warm-200 pt-3 text-xs leading-snug text-gray-600">
                  {t("extrasHowTo")}
                </p>
                {(gallery?.gift_remaining ?? 0) > 0 && (
                  /* Its own soft ground so the present reads as a present and
                     not as more small print under the price. */
                  <p className="mt-2.5 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-snug text-rose-900 ring-1 ring-rose-100">
                    🎁 {t("extrasFreeFirst", { count: gallery.gift_remaining ?? 0, name: normalizeName(gallery.photographer_name).split(" ")[0] })}
                  </p>
                )}
              </>
            )}

            {accepted ? (
              <p className="mt-3 border-t border-warm-200 pt-3 text-[11px] text-gray-400">
                {t("availableUntil", { date: expiresDate })}
              </p>
            ) : null}
          </div>

          {/* Actions. One primary at a time — download after acceptance, the
              locked notice before it. */}
          <div className="flex flex-col gap-3 rounded-2xl border border-warm-200 bg-white p-4">
          {/* Only AFTER acceptance. The main archive is written once, at
          acceptance, and now contains everything the client owns by then —
          promised photos plus any extra already taken, free or paid. Before
          that moment a second archive would split their photos into two
          downloads for no reason, and offering "download your 10 extra
          photos" while the other five are still locked reads as nonsense.
          Anything bought later cannot reach the frozen main file, so from
          acceptance onward the second archive earns its place. */}
          {accepted && (gallery?.extras_owned ?? 0) > 0 && (
          <div className="mb-3">
          {gallery?.extras_zip_ready ? (
          <a
          href={`/api/delivery/${token}/download?set=extras&password=${encodeURIComponent(password || sessionStorage.getItem(`delivery_pw_${token}`) || "")}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-warm-200 bg-warm-50 px-4 py-2.5 text-xs font-semibold text-gray-700 transition hover:bg-warm-100"
          >
          {t("extrasDownload", { count: gallery.extras_owned ?? 0 })}
          {gallery.extras_zip_size ? <span className="text-xs opacity-75">({(gallery.extras_zip_size / (1024 * 1024)).toFixed(0)} MB)</span> : null}
          </a>
          ) : (
          <span className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-500">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          {t("extrasZipPreparing")}
          </span>
          )}
          </div>
          )}
          {accepted ? (
          gallery?.zip_ready ? (
          <a
          href={`/api/delivery/${token}/download?password=${encodeURIComponent(password || sessionStorage.getItem(`delivery_pw_${token}`) || "")}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-700"
          >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {t("downloadAllZip")}
          {gallery.zip_size && <span className="text-xs opacity-75">({(gallery.zip_size / (1024 * 1024)).toFixed(0)} MB)</span>}
          </a>
          ) : (
          <span className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-3 text-sm font-medium text-gray-500">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Preparing ZIP...
          </span>
          )
          ) : isOwner ? (
          <div className="rounded-xl bg-amber-100 px-5 py-3 text-sm text-amber-800">
          <span className="flex items-start gap-2 font-medium">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {t("acceptToUnlockFullRes")}
          </span>
          {autoAcceptAt && daysLeft > 0 ? (
          <span className="mt-1.5 block pl-6 text-xs font-semibold text-amber-700">
          {t("acceptWindow", { days: daysLeft, date: autoAcceptDate })}
          </span>
          ) : null}
          </div>
          ) : null}
          </div>

          {/* Accept Delivery Section — only for the logged-in client who owns this booking */}
          {isOwner ? (
          <div className="mt-6">
          {accepted ? (
          <>
          <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
          <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          </div>
          <div>
          <p className="font-semibold text-green-700">{t("deliveryAccepted")}</p>
          <p className="text-sm text-green-600">{t("deliveryAcceptedThankYou")}</p>
          </div>
          </div>
          </div>
          {/* Optional tip — peak-happiness moment, right below the accept
          confirmation, NEVER between the client and the download. */}
          {tipJustSent || gallery.tipped ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="font-semibold text-amber-800">💛 {t("tipThanks", { name: normalizeName(gallery.photographer_name).split(" ")[0] })}</p>
          </div>
          ) : gallery.tip_allowed !== false && !tipDismissed ? (
          <TipCard
          token={token}
          photographerName={normalizeName(gallery.photographer_name).split(" ")[0]}
          photographerAvatar={gallery.photographer_avatar}
          password={password || (typeof window !== "undefined" ? sessionStorage.getItem(`delivery_pw_${token}`) || "" : "")}
          onDismiss={() => {
          setTipDismissed(true);
          try { localStorage.setItem(`tip_dismissed_${gallery.booking_id}`, "1"); } catch {}
          }}
          />
          ) : null}
          </>
          ) : (
          <div className="rounded-2xl border border-warm-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">{t("happyWithPhotos")}</p>

            {/* Permission to show a few of these on our own social accounts.
                Deliberately above the button and not in a footnote: it is a
                request, and a request the client cannot see is not one. */}
            <label className="mt-3 flex cursor-pointer gap-3 rounded-xl border border-primary-200 bg-primary-50/60 p-3 transition hover:border-primary-300">
              <input
                type="checkbox"
                checked={socialConsent}
                onChange={(e) => setSocialConsent(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="flex gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://${FILES_HOST}/avatars/686ad75a-fa5b-4dcb-bdd7-7ec30d9e8910.jpg`}
                  alt=""
                  className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover"
                />
                <span className="text-xs leading-snug text-gray-700">
                  <span className="block font-semibold text-gray-900">{t("socialConsentTitle")}</span>
                  <span className="mt-0.5 block">{t("socialConsentBody")}</span>
                </span>
              </span>
            </label>

            <button
              onClick={handleAcceptDelivery}
              disabled={accepting}
              className="mt-3 w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {accepting ? t("accepting") : t("acceptDelivery")}
            </button>
            <p className="mt-2 text-xs leading-snug text-gray-500">{t("acceptReleasesPayment")}</p>
            <div className="mt-3 border-t border-warm-200 pt-2 text-xs">
              <DisputeForm bookingId={gallery.booking_id} token={token} />
            </div>
            {acceptError && (
              <p className="mt-3 text-xs leading-snug text-red-600">{acceptError}</p>
            )}
          </div>
          )}
          </div>
          ) : !accepted && (
          <div className="mt-6 rounded-xl border border-warm-200 bg-warm-50 p-5 text-center">
          <p className="text-sm text-gray-500">{t("loginToAccept")}</p>
          <a href="/auth/signin" className="mt-3 inline-block rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700">
          {t("logIn")}
          </a>
          </div>
          )}

          {/* The rail gives the basket a permanent home, so it can stop being a
              pill that floats over the photographs and become a summary that
              answers the question a pill cannot: WHICH ones did I choose. On a
              phone there is no rail, so it stays a fixed bar at the bottom. */}
          {selectedExtras.size > 0 && (
            <div className="fixed inset-x-3 bottom-3 z-30 rounded-2xl bg-gray-900 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.55)] ring-1 ring-white/10 lg:static lg:inset-auto lg:shadow-lg">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-bold leading-none text-white">
                    {(() => {
                      const free = Math.min(selectedExtras.size, gallery.gift_remaining ?? 0);
                      const paid = selectedExtras.size - free;
                      if (free > 0 && paid === 0) return t("giftAllFree", { count: free });
                      return money(paid * (gallery.extras_price_cents ?? 290));
                    })()}
                  </p>
                  <p className="mt-1 text-xs text-gray-300">{t("extrasSelected", { count: selectedExtras.size })}</p>
                </div>
                <p className="hidden text-[11px] leading-snug text-gray-400 sm:block lg:hidden">{t("extrasNothingChargedYet")}</p>
              </div>

              {/* Which three. Without this a client who picked photo 7, 31 and
                  44 has to scroll back to find out what is in their basket. */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(gallery.photos ?? [])
                  .filter((ph) => selectedExtras.has(ph.id))
                  .slice(0, 8)
                  .map((ph) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={ph.id}
                      src={ph.thumbnail_url || ph.preview_url || ph.url}
                      alt=""
                      className="h-10 w-10 rounded-md object-cover ring-1 ring-white/20"
                    />
                  ))}
                {selectedExtras.size > 8 && (
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-gray-200">
                    +{selectedExtras.size - 8}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  onClick={async () => {
                    // One tap next to Buy that throws away a selection someone
                    // built photo by photo. Cheap to confirm, annoying to redo.
                    const ok = await confirm(
                      t("extrasClear"),
                      t("extrasClearConfirm", { count: selectedExtras.size }),
                      { confirmLabel: t("extrasClear") }
                    );
                    if (!ok) return;
                    setSelectedExtras(new Set());
                    try { sessionStorage.removeItem(extrasKey); } catch {}
                  }}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-gray-300 transition hover:text-white"
                >
                  {t("extrasClear")}
                </button>
                <button
                  onClick={buyExtras}
                  disabled={buyingExtras}
                  className="flex-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50 lg:flex-none"
                >
                  {buyingExtras ? "…" : t("extrasBuy")}
                </button>
              </div>
            </div>
          )}



        </aside>

        <main className="min-w-0">

          <header className="mt-6 flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100">
              {photographerAvatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={photographerAvatar} alt={normalizeName(photographerName)} className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-primary-600">{normalizeName(photographerName).charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-balance font-display text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
                {deliveryTitle?.trim() || t("photosReady")}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {normalizeName(gallery.photographer_name)}
                {gallery.shoot_date ? ` · ${new Date(gallery.shoot_date).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}` : ""}
              </p>
            </div>
          </header>

          {deliveryMessage?.trim() && (
          <div className="mt-5 max-w-2xl rounded-2xl border border-warm-200 bg-warm-50 px-5 py-4 text-left">
          <p className="whitespace-pre-line text-sm text-gray-700 leading-relaxed sm:text-base">
          {deliveryMessage.trim()}
          </p>
          </div>
          )}
          {/* Gallery */}
          <DeliveryGalleryClient
          photos={gallery.photos}
          deliveryAccepted={accepted}
          selectedExtras={selectedExtras}
          onToggleExtra={toggleExtra}
          onSwap={swapPhoto}
          onReorder={reorderPhotos}
          onTakeAll={takeAllExtras}
          takingAll={takingAll}
          extrasPriceCents={gallery?.extras_price_cents ?? 290}
          giftLeft={gallery?.gift_remaining ?? 0}
          photographerFirstName={normalizeName(gallery.photographer_name).split(" ")[0]}
          onUngift={ungiftPhoto}
          revealFor={revealFor}
          />


        </main>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-sm text-gray-400">
          {t("deliveredVia")} <a href={`${country.baseUrl}`} className="text-primary-600 hover:underline">{country.brand}</a>
        </p>
      </div>
      {modal}
    </div>
  );
}

/** Optional post-delivery tip card. Warm, dismissible, never gates the
 *  download (it renders BELOW the accept confirmation, download lives in
 *  the stats bar above). Fixed € presets — percent framing reads like a
 *  second service fee on €300-800 bookings. Nothing is pre-selected. */
function TipCard({ token, photographerName, photographerAvatar, password, onDismiss }: {
  token: string;
  photographerName: string;
  photographerAvatar: string | null;
  password: string;
  onDismiss: () => void;
}) {
  const t = useTranslations("delivery");
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const PRESETS = [20, 40, 60];

  const effective = showCustom ? Math.round(Number(custom)) : amount;
  const valid = Number.isFinite(effective) && (effective as number) >= 5 && (effective as number) <= 500;

  async function sendTip() {
    if (!valid || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/delivery/${token}/tip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_eur: effective, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data?.error || t("tipError"));
        setSending(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(t("tipError"));
      setSending(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-warm-200 bg-warm-50 p-5">
      <div className="flex items-start gap-3">
        {photographerAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photographerAvatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg">💛</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">{t("tipHeading", { name: photographerName })}</p>
          <p className="mt-0.5 text-sm text-gray-500">{t("tipSub", { name: photographerName })}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setAmount(p); setShowCustom(false); }}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${!showCustom && amount === p ? "border-amber-500 bg-amber-100 text-amber-800" : "border-warm-200 bg-white text-gray-700 hover:border-amber-300"}`}
              >
                €{p}
              </button>
            ))}
            {showCustom ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500 bg-amber-100 px-3 py-1">
                <span className="text-sm font-semibold text-amber-800">€</span>
                <input
                  autoFocus
                  type="number"
                  min={5}
                  max={500}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="w-16 border-0 bg-transparent text-sm font-semibold text-amber-800 focus:outline-none"
                />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => { setShowCustom(true); setAmount(null); }}
                className="rounded-full border border-warm-200 bg-white px-4 py-1.5 text-sm font-semibold text-gray-700 transition hover:border-amber-300"
              >
                {t("tipCustom")}
              </button>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              onClick={sendTip}
              disabled={!valid || sending}
              className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-40"
            >
              {sending ? "…" : valid ? t("tipSend", { amount: effective as number }) : t("tipSendDisabled")}
            </button>
            <button type="button" onClick={onDismiss} className="text-sm text-gray-400 hover:text-gray-600">
              {t("tipLater")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

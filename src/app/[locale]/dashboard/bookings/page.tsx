import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { ReviewForm } from "@/components/ui/ReviewForm";
import { PromisedPhotosInput } from "./PromisedPhotosInput";
import { PayButton } from "@/components/ui/PayButton";
import { BookingStatusButtons } from "./BookingStatusButtons";
import { DateNegotiation } from "./DateNegotiation";
import { ChangeDateButton } from "./ChangeDateButton";
import { Avatar } from "@/components/ui/Avatar";
import { PaymentTracker } from "./PaymentTracker";
import PaymentCountdown from "./PaymentCountdown";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { BookingJourney } from "./BookingJourney";
import { ProposalSmsToggle } from "./ProposalSmsToggle";
import { normalizeName } from "@/lib/format-name";
import { bookingStripePaymentSelect } from "@/lib/booking-stripe-payment-fields";
import { bookingGroupSizeEstimateSelect } from "@/lib/booking-group-size-fields";

export const dynamic = "force-dynamic";

const TIME_LABEL_KEYS: Record<string, string> = {
  sunrise: "timeSunrise",
  morning: "timeMorning",
  midday: "timeMidday",
  afternoon: "timeAfternoon",
  golden_hour: "timeGoldenHour",
  sunset: "timeSunset",
};

function formatStripeAmount(cents: number | null, currency: string | null) {
  if (typeof cents !== "number") return null;
  const symbol = (currency || "eur").toLowerCase() === "eur" ? "€" : `${(currency || "").toUpperCase()} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function formatGroupSizeLabel(count: number | null, isEstimate: boolean, peopleLabel: (count: number) => string) {
  if (!count || count <= 1) return null;
  const label = peopleLabel(count);
  return isEstimate ? label.replace(String(count), `${count}+`) : label;
}

export default async function BookingsPage() {
  const session = await auth();
  const t = await getTranslations("bookings");
  const locale = await getLocale();
  const dateLocale = ({pt:"pt-PT",de:"de-DE",es:"es-ES",fr:"fr-FR",en:"en-US"} as Record<string,string>)[locale] || "en-US";
  if (!session?.user) return null;

  const userId = (session.user as { id?: string }).id;
  const user = await queryOne<{ role: string; avatar_url: string | null; phone: string | null }>("SELECT role, avatar_url, phone FROM users WHERE id = $1", [userId]);
  const isPhotographer = user?.role === "photographer";

  let bookings: {
    id: string;
    other_name: string;
    other_slug: string;
    other_avatar: string | null;
    package_name: string | null;
    status: string;
    shoot_date: string | null;
    shoot_time: string | null;
    flexible_date_from: string | null;
    flexible_date_to: string | null;
    proposed_date: string | null;
    proposed_by: string | null;
    proposed_time: string | null;
    date_note: string | null;
    group_size: number | null;
    group_size_is_estimate: boolean;
    occasion: string | null;
    client_sms_opt_in: boolean;
    total_price: number | null;
    service_fee: number | null;
    payout_amount: number | null;
    blind_booking: boolean | null;
    promised_photos: number | null;
    tip_amount_cents: number | null;
    tip_payout_cents: number | null;
    peek_token?: string | null;
    peek_shared_at?: string | null;
    stripe_amount_paid_cents: number | null;
    stripe_amount_discount_cents: number | null;
    stripe_currency: string | null;
    stripe_promo_code: string | null;
    duration_minutes: number | null;
    location_slug: string | null;
    location_detail: string | null;
    message: string | null;
    created_at: string;
    client_country: string | null;
    has_review: boolean;
    payment_status: string | null;
    delivery_token: string | null;
    delivery_accepted: boolean;
    delivery_expires_at: string | null;
    delivery_chat_payload: string | null;
    // When status='pending' and photographer has sent a custom
    // BOOKING_CARD chat message: the client must tap the card in
    // chat to start the new booking (the pending one here can't be
    // upgraded). We carry the latest such payload to the renderer so
    // we can show a yellow "tap the card in chat" callout instead of
    // a misleading "waiting for photographer" status.
    custom_package_card_payload: string | null;
    payment_url: string | null;
    updated_at: string;
    confirmed_at: string | null;
    cancelled_at: string | null;
    cancelled_by: string | null;
    cancelled_reason: string | null;
    has_photographer_message: boolean;
    is_gift?: boolean;
    gift_recipient_name?: string | null;
    gift_recipient_phone_visible?: string | null;
    gift_recipient_email_visible?: string | null;
    gift_reveal_at?: string | null;
    gift_reveal_sent_at?: string | null;
    gift_card_id?: string | null;
    gift_card_tier?: "express" | "full" | null;
    viewer_role?: "client" | "gift_buyer" | "gift_recipient" | "photographer";
  }[] = [];
  const stripePaymentSelect = await bookingStripePaymentSelect("b");
  const groupSizeEstimateSelect = await bookingGroupSizeEstimateSelect("b");

  try {
    if (isPhotographer) {
      const profile = await queryOne<{ id: string }>("SELECT id FROM photographer_profiles WHERE user_id = $1", [userId]);
      if (profile) {
        bookings = await query(
          `SELECT b.id, u.name as other_name, '' as other_slug, u.avatar_url as other_avatar,
                  p.name as package_name, p.duration_minutes, b.status, b.shoot_date, b.shoot_time, b.flexible_date_from, b.flexible_date_to, b.proposed_date, b.proposed_by, b.proposed_time, b.date_note, b.group_size, ${groupSizeEstimateSelect}, b.occasion, b.total_price, b.service_fee, b.payout_amount, b.blind_booking, b.promised_photos,
                  ${stripePaymentSelect},
                  b.location_slug, b.location_detail, b.message, b.created_at, b.payment_status,
                  FALSE as has_review, b.delivery_token,
                  (SELECT t.amount_cents FROM tips t WHERE t.booking_id = b.id AND t.status = 'paid' LIMIT 1) as tip_amount_cents,
                  (SELECT t.payout_cents FROM tips t WHERE t.booking_id = b.id AND t.status = 'paid' LIMIT 1) as tip_payout_cents,
                  COALESCE(b.delivery_accepted, FALSE) as delivery_accepted,
                  b.delivery_expires_at,
                  COALESCE(b.is_gift, FALSE) as is_gift,
                  b.gift_recipient_name,
                  -- Recipient WhatsApp/email surface ONLY after reveal — keeps the
                  -- surprise intact when the buyer asked for a delayed reveal.
                  CASE WHEN b.gift_reveal_sent_at IS NOT NULL THEN b.gift_recipient_phone END as gift_recipient_phone_visible,
                  CASE WHEN b.gift_reveal_sent_at IS NOT NULL THEN b.gift_recipient_email END as gift_recipient_email_visible,
                  b.gift_reveal_at,
                  b.gift_reveal_sent_at,
                  -- Gift card redemption (separate from gift-booking above).
                  -- gift_card_id is set when the recipient redeemed a Photo
                  -- Portugal gift card on this booking — payout is locked to
                  -- the tier price and we render a "🎁 Gift Card" tag.
                  b.gift_card_id,
                  gc.tier::text as gift_card_tier,
                  'photographer' as viewer_role,
                  NULL::text as delivery_chat_payload,
                  b.payment_url, b.updated_at, b.confirmed_at,
                  b.cancelled_at, b.cancelled_by, b.cancelled_reason,
                  EXISTS (
                    SELECT 1
                    FROM messages m
                    JOIN bookings previous_b ON previous_b.id = m.booking_id
                    WHERE previous_b.client_id = b.client_id
                      AND previous_b.photographer_id = b.photographer_id
                      AND m.sender_id = $2
                      AND COALESCE(m.is_system, FALSE) = FALSE
                  ) as has_photographer_message,
                  (SELECT vs.country FROM visitor_sessions vs WHERE vs.user_id = b.client_id AND vs.country IS NOT NULL ORDER BY vs.started_at DESC LIMIT 1) as client_country
           FROM bookings b
           JOIN users u ON u.id = b.client_id
           LEFT JOIN packages p ON p.id = b.package_id
           LEFT JOIN gift_cards gc ON gc.id = b.gift_card_id
           -- Hide cancelled bookings older than 30 days from the
           -- main list (still visible in admin / DB). cancelled_at
           -- is set whenever status flips to 'cancelled'; legacy
           -- rows without it stay visible until backfill.
           WHERE b.photographer_id = $1 AND b.status != 'inquiry'
             AND NOT (b.status = 'cancelled' AND b.cancelled_at IS NOT NULL AND b.cancelled_at < NOW() - INTERVAL '30 days')
           ORDER BY b.created_at DESC`,
          [profile.id, userId]
        );
      }
    } else {
      // Buyer sees their bookings. Gift recipient sees the booking too
      // (so they can accept delivery / leave review) — but ONLY after
      // reveal time, otherwise we'd spoil the surprise by showing the
      // booking in their dashboard before they got the gift email.
      bookings = await query(
        `SELECT b.id, u.name as other_name, pp.slug as other_slug, u.avatar_url as other_avatar,
                p.name as package_name, p.duration_minutes, b.status, b.shoot_date, b.shoot_time, b.flexible_date_from, b.flexible_date_to, b.proposed_date, b.proposed_by, b.proposed_time, b.date_note, b.group_size, ${groupSizeEstimateSelect}, b.occasion, COALESCE(b.client_sms_opt_in, false) as client_sms_opt_in, b.total_price, b.service_fee, b.payout_amount, b.blind_booking, b.promised_photos,
                ${stripePaymentSelect},
                b.location_slug, b.location_detail, b.message, b.created_at, b.payment_status,
                (SELECT COUNT(*) FROM reviews r WHERE r.booking_id = b.id) > 0 as has_review, b.delivery_token,
                b.peek_token, b.peek_shared_at::text as peek_shared_at,
                (SELECT t.amount_cents FROM tips t WHERE t.booking_id = b.id AND t.status = 'paid' LIMIT 1) as tip_amount_cents,
                (SELECT t.payout_cents FROM tips t WHERE t.booking_id = b.id AND t.status = 'paid' LIMIT 1) as tip_payout_cents,
                COALESCE(b.delivery_accepted, FALSE) as delivery_accepted,
                b.delivery_expires_at,
                COALESCE(b.is_gift, FALSE) as is_gift,
                b.gift_recipient_name,
                b.gift_card_id,
                gc.tier::text as gift_card_tier,
                CASE
                  WHEN b.client_id = $1 AND b.is_gift = TRUE THEN 'gift_buyer'
                  WHEN b.gift_recipient_user_id = $1 THEN 'gift_recipient'
                  ELSE 'client'
                END as viewer_role,
                (SELECT m.text FROM messages m
                  WHERE m.booking_id = b.id AND m.text LIKE 'DELIVERY:%'
                  ORDER BY m.created_at DESC LIMIT 1) as delivery_chat_payload,
                -- Latest CUSTOM BOOKING_CARD payload from the
                -- photographer on this booking — when set + status
                -- still 'pending', it means the photographer wants
                -- the client to tap the chat card to spawn a new
                -- booking rather than wait for confirmation on this
                -- one. Drives the yellow callout in the UI.
                (SELECT m.text FROM messages m
                  WHERE m.booking_id = b.id
                    AND m.text LIKE 'BOOKING_CARD:%'
                    AND m.text LIKE '%"is_custom":true%'
                    AND m.text NOT LIKE '%"revoked":true%'
                    AND m.sender_id != b.client_id
                  ORDER BY m.created_at DESC LIMIT 1) as custom_package_card_payload,
                b.payment_url, b.updated_at, b.confirmed_at,
                b.cancelled_at, b.cancelled_by, b.cancelled_reason,
                FALSE as has_photographer_message
         FROM bookings b
         LEFT JOIN photographer_profiles pp ON pp.id = b.photographer_id
         LEFT JOIN users u ON u.id = pp.user_id
         LEFT JOIN packages p ON p.id = b.package_id
         LEFT JOIN gift_cards gc ON gc.id = b.gift_card_id
         WHERE (
           b.client_id = $1
           OR (b.gift_recipient_user_id = $1 AND b.gift_reveal_sent_at IS NOT NULL)
         )
           AND b.status != 'inquiry'
           AND NOT (b.status = 'cancelled' AND b.cancelled_at IS NOT NULL AND b.cancelled_at < NOW() - INTERVAL '30 days')
         ORDER BY b.created_at DESC`,
        [userId]
      );
    }
  } catch {}

  // Serialize Date objects to strings (node-postgres returns date columns as Date objects)
  for (const b of bookings) {
    const rec = b as Record<string, unknown>;
    for (const key of ["shoot_date", "proposed_date", "flexible_date_from", "flexible_date_to", "created_at", "gift_reveal_at", "gift_reveal_sent_at"]) {
      const val = rec[key];
      if (val && typeof val === "object" && "toISOString" in (val as object)) rec[key] = (val as Date).toISOString();
    }
  }

  const bookingAmounts = Object.fromEntries(bookings.map((b) => [b.id, Number(b.total_price) || 0]));

  return (
    <div className="p-6 sm:p-8">
      <PaymentTracker bookingAmounts={bookingAmounts} />
      {!isPhotographer && (
        <div className="mb-6">
          <OnboardingChecklist
            role="client"
            userId={userId!}
            checks={{
              // A Google-default avatar isn't really "their photo" — it's
              // a generic profile pic the photographer can't use to
               // recognize them. Only treat the step as done when the user
              // has uploaded an avatar to our own storage (R2).
              avatar: !!user?.avatar_url && user.avatar_url.includes("files.photoportugal.com"),
              cover: false,
              bio: false,
              portfolio: 0,
              packages: 0,
              locations: 0,
              stripeConnected: false,
              phone: !!user?.phone,
              bookings: bookings.length,
            }}
          />
        </div>
      )}
      <h1 className="font-display text-2xl font-bold text-gray-900">
        {isPhotographer ? t("bookingRequests") : t("myBookings")}
      </h1>
      <p className="mt-1 text-gray-500">
        {isPhotographer ? t("manageIncoming") : t("trackBookings")}
      </p>

      {bookings.length > 0 ? (
        <div className="mt-6 space-y-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="rounded-xl border border-warm-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar src={booking.other_avatar} fallback={normalizeName(booking.other_name)} size="md" />
                  <div>
                    {booking.other_slug ? (
                      <Link href={`/photographers/${booking.other_slug}`} className="font-semibold text-gray-900 hover:text-primary-600">
                        {normalizeName(booking.other_name)}
                      </Link>
                    ) : (
                      <p className="font-semibold text-gray-900">{normalizeName(booking.other_name)}</p>
                    )}
                    {booking.package_name && (
                      <p className="text-sm text-gray-500">{booking.package_name}</p>
                    )}
                    {/* Gift badge & framing — three audiences:
                        - buyer of a gift: "🎁 Gift for X"
                        - recipient: "🎁 Gift from someone"
                        - photographer: just "🎁 Gift booking" (the
                          recipient's identity may still be a surprise) */}
                    {booking.is_gift && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                        🎁 {booking.viewer_role === "gift_buyer"
                          ? `Gift for ${booking.gift_recipient_name || "someone"}`
                          : booking.viewer_role === "gift_recipient"
                          ? `Gift from ${normalizeName(booking.other_name)}`
                          : booking.viewer_role === "photographer"
                          ? (booking.gift_reveal_sent_at
                              ? `Gift booking — recipient: ${booking.gift_recipient_name || "—"}`
                              : "Gift booking — recipient details after reveal")
                          : "Gift booking"}
                      </p>
                    )}
                    {/* Gift CARD redemption tag — separate from gift booking.
                        A "Gift Card" booking is one where the client paid €0
                        because they redeemed a Photo Portugal gift card.
                        Photographer payout is the flat tier amount. */}
                    {booking.gift_card_id && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        🎁 Gift Card ({booking.gift_card_tier === "express" ? "Express" : booking.gift_card_tier === "full" ? "Full" : "—"})
                      </p>
                    )}
                    {/* Photographer-only: recipient contact line that
                        appears after gift_reveal_sent_at. Hidden before
                        so the photographer doesn't ping the recipient
                        and ruin the surprise. */}
                    {booking.is_gift && booking.viewer_role === "photographer" && booking.gift_recipient_phone_visible && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        WhatsApp: <a href={`https://wa.me/${booking.gift_recipient_phone_visible.replace(/\D/g, "")}`} className="text-primary-600 hover:underline">{booking.gift_recipient_phone_visible}</a>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {booking.status === "cancelled" && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">{t("statusCancelled")}</span>
                  )}
                  {booking.payment_status === "refunded" && (
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">{t("refunded")}</span>
                  )}
                  {!isPhotographer && booking.status === "confirmed" && booking.payment_status !== "paid" && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">⏳ {t("slotNotLockedUntilPaid")}</span>
                  )}
                </div>
              </div>

              {/* Custom-package callout — when the photographer has
                  sent a custom BOOKING_CARD in chat and this booking
                  is still 'pending', the client must tap the card to
                  spawn a new (payable) booking. Without this hint,
                  clients tap the pending row, see "waiting for
                  photographer to confirm", and get stuck (real case:
                  Andrew Ballard / Daria 2026-06-08). */}
              {!isPhotographer
                && booking.status === "pending"
                && booking.custom_package_card_payload
                && (() => {
                  let pkg: { name?: string; price?: number; duration_minutes?: number; num_photos?: number } | null = null;
                  try {
                    pkg = JSON.parse(booking.custom_package_card_payload.slice("BOOKING_CARD:".length));
                  } catch {}
                  return (
                    <div className="mt-3 rounded-lg border-l-4 border-amber-500 bg-amber-50 px-3.5 py-3 text-sm">
                      <p className="font-semibold text-amber-900">
                        💬 {t("customPackageInChatTitle")}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                        {pkg?.name
                          ? t("customPackageInChatExplain", { packageName: pkg.name })
                          : t("customPackageInChatExplainGeneric")}
                      </p>
                      <a
                        href={`/dashboard/messages/${booking.id}`}
                        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
                      >
                        {t("openChatToTapCard")} →
                      </a>
                    </div>
                  );
                })()}

              {/* Cancellation reason banner — shows who cancelled and
                  why. Reason text is whatever the canceller typed (or
                  the auto-cancel system message). Renders only for
                  cancelled bookings. */}
              {booking.status === "cancelled" && booking.cancelled_reason && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {t("cancellationReasonLabel", { by: booking.cancelled_by || "system" })}
                  </p>
                  <p className="mt-1 text-gray-700 italic">&ldquo;{booking.cancelled_reason}&rdquo;</p>
                </div>
              )}

              {booking.status !== "cancelled" && (
                <BookingJourney
                  status={booking.status}
                  paymentStatus={booking.payment_status}
                  deliveryAccepted={booking.delivery_accepted}
                  isPhotographer={isPhotographer}
                  shootDate={booking.shoot_date}
                  deliveryToken={booking.delivery_token}
                  action={
                    <div className="flex flex-wrap gap-2">
                      {isPhotographer && (booking.status === "pending" || booking.status === "confirmed" || booking.status === "completed" || booking.status === "delivered") && (
                        <BookingStatusButtons bookingId={booking.id} currentStatus={booking.status} paymentStatus={booking.payment_status} deliveryAccepted={booking.delivery_accepted} shootDate={booking.shoot_date} clientFirstName={isPhotographer ? normalizeName(booking.other_name) : undefined} hasPhotographerMessage={booking.has_photographer_message} />
                      )}
                      {!isPhotographer && booking.status === "confirmed" && booking.payment_status !== "paid" && booking.total_price && (
                        <PayButton bookingId={booking.id} amount={Number(booking.total_price)} blind={!!booking.blind_booking} />
                      )}
                      {!isPhotographer && booking.status === "delivered" && booking.delivery_token && (
                        <Link
                          href={`/delivery/${booking.delivery_token}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700"
                        >
                          {t("viewPhotos")}
                        </Link>
                      )}
                    </div>
                  }
                />
              )}

              {/* Surprise-proposal discretion: SMS off by default, opt-in here. */}
              {!isPhotographer
                && booking.occasion && /proposal/i.test(booking.occasion)
                && !["cancelled", "completed", "delivered"].includes(booking.status) && (
                <ProposalSmsToggle bookingId={booking.id} initialOptIn={!!booking.client_sms_opt_in} />
              )}

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(booking.shoot_date || (booking.flexible_date_from && booking.flexible_date_to)) && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("shootDate") || "Date"}</p>
                    <p className="text-sm font-medium text-gray-800">
                      {booking.shoot_date
                        ? new Date(booking.shoot_date).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
                        : t("flexibleRange", { from: new Date(booking.flexible_date_from!).toLocaleDateString(dateLocale, { month: "short", day: "numeric" }), to: new Date(booking.flexible_date_to!).toLocaleDateString(dateLocale, { month: "short", day: "numeric" }) })}
                    </p>
                    {booking.shoot_time && (
                      <p className="text-xs text-gray-500">{TIME_LABEL_KEYS[booking.shoot_time] ? t(TIME_LABEL_KEYS[booking.shoot_time]) : booking.shoot_time}</p>
                    )}
                    {/* Inline "Change" button — only when the booking is
                        still in a state where rescheduling is allowed. */}
                    {!["cancelled", "completed", "delivered"].includes(booking.status) && (
                      <ChangeDateButton
                        bookingId={booking.id}
                        shootDate={booking.shoot_date}
                        shootTime={booking.shoot_time}
                        otherName={normalizeName(booking.other_name).split(" ")[0]}
                      />
                    )}
                  </div>
                )}
                {booking.total_price && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    {isPhotographer && Number(booking.payout_amount) > 0 ? (
                      /* Photographers see their PAYOUT (what they receive),
                         not the session base or the client's gross — base is
                         shown small as context. */
                      <>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("yourPayout") || "Your payout"}</p>
                        <p className="text-sm font-medium text-green-700">&euro;{Math.round(Number(booking.payout_amount))}</p>
                        {/* Tip payout (their 90% share) — separate line, never
                            folded into payout_amount. */}
                        {Number(booking.tip_payout_cents) > 0 && (
                          <p className="text-[11px] font-semibold text-amber-700">💛 {t("tipLine")}: &euro;{(Number(booking.tip_payout_cents) / 100).toFixed(2)}</p>
                        )}
                        <p className="text-[10px] font-medium text-gray-400">{t("sessionPrice") || "Session price"}: &euro;{Math.round(Number(booking.total_price))}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("price") || "Price"}</p>
                        {/* Blind summer offer: the CLIENT saw the all-inclusive
                            number (base / 0.85) — never show them the internal
                            base. Photographers keep seeing the base (their rate). */}
                        <p className="text-sm font-medium text-gray-800">&euro;{Math.round(Number(booking.total_price) / (booking.blind_booking && !isPhotographer ? 0.85 : 1))}</p>
                        {booking.stripe_amount_paid_cents !== null && !isPhotographer && (
                          <p className="text-[10px] font-medium text-green-700">
                            Paid: {formatStripeAmount(booking.stripe_amount_paid_cents, booking.stripe_currency)}
                          </p>
                        )}
                        {Number(booking.stripe_amount_discount_cents) > 0 && !isPhotographer && (
                          <p className="text-[10px] font-medium text-primary-600">
                            Discount: -{formatStripeAmount(booking.stripe_amount_discount_cents, booking.stripe_currency)}
                            {booking.stripe_promo_code ? ` · ${booking.stripe_promo_code}` : ""}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
                {/* Blind bookings: photographer commits a photo count; client sees it */}
                {booking.blind_booking && !booking.package_name && isPhotographer && booking.status === "confirmed" && (
                  <PromisedPhotosInput bookingId={booking.id} initial={booking.promised_photos} />
                )}
                {booking.blind_booking && !isPhotographer && booking.promised_photos && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2 text-xs text-gray-600">
                    📸 {t("promisedPhotosClient", { count: booking.promised_photos })}
                  </div>
                )}
                {booking.package_name && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("packageLabel") || "Package"}</p>
                    <p className="text-sm font-medium text-gray-800">{booking.package_name}</p>
                    {booking.duration_minutes && <p className="text-xs text-gray-500">{booking.duration_minutes < 60 ? `${booking.duration_minutes} min` : `${booking.duration_minutes / 60}h`}</p>}
                  </div>
                )}
                {booking.location_slug && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("locationLabel") || "Location"}</p>
                    <p className="text-sm font-medium text-gray-800 capitalize">{booking.location_slug.replace(/-/g, " ")}</p>
                    {booking.location_detail && <p className="text-xs text-gray-500">{booking.location_detail}</p>}
                  </div>
                )}
                {booking.occasion && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("occasion") || "Occasion"}</p>
                    <p className="text-sm font-medium text-gray-800 capitalize">{booking.occasion}</p>
                  </div>
                )}
                {booking.group_size && booking.group_size > 1 && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("groupLabel") || "Group"}</p>
                    <p className="text-sm font-medium text-gray-800">
                      {formatGroupSizeLabel(booking.group_size, booking.group_size_is_estimate, (count) => t("people", { count }))}
                    </p>
                  </div>
                )}
                <div className="rounded-lg bg-warm-50 px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{t("requestedLabel") || "Requested"}</p>
                  <p className="text-sm font-medium text-gray-800">{new Date(booking.created_at).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
                {isPhotographer && booking.client_country && (
                  <div className="rounded-lg bg-warm-50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Client</p>
                    <p className="text-sm font-medium text-gray-800">{booking.client_country.toUpperCase().replace(/./g, (c: string) => String.fromCodePoint(127397 + c.charCodeAt(0)))} {(() => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(booking.client_country!); } catch { return booking.client_country; } })()}</p>
                  </div>
                )}
              </div>

              {booking.message && (
                <p className="mt-3 rounded-lg bg-warm-50 px-3 py-2 text-sm text-gray-600 italic">&ldquo;{booking.message}&rdquo;</p>
              )}

              {booking.status === "confirmed" && booking.payment_status !== "paid" && booking.total_price && (
                <>
                  {!isPhotographer && (
                    <div className="mt-3 rounded-lg border-l-4 border-amber-500 bg-amber-50 px-3.5 py-2.5 text-sm">
                      <p className="font-semibold text-amber-900">⏳ {t("slotNotLockedTitle")}</p>
                      <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">{t("slotLocksExplain")}</p>
                    </div>
                  )}
                  <PaymentCountdown
                    confirmedAt={booking.confirmed_at || booking.updated_at}
                    viewerRole={isPhotographer ? "photographer" : "client"}
                  />
                </>
              )}

              {!["cancelled", "completed", "delivered"].includes(booking.status) && (
                <DateNegotiation
                  bookingId={booking.id}
                  shootDate={booking.shoot_date}
                  proposedDate={booking.proposed_date}
                  proposedBy={booking.proposed_by}
                  proposedTime={booking.proposed_time}
                  dateNote={booking.date_note}
                  isPhotographer={isPhotographer}
                  otherName={normalizeName(booking.other_name).split(" ")[0]}
                />
              )}

              {/* CLIENT — prominent "See Your Photos" CTA. Visible from
                  the moment the photographer shares delivery (status=delivered,
                  pre OR post accept) until the gallery's 90-day public link
                  expires. We pull the plaintext password out of the auto-sent
                  DELIVERY chat message so the link opens the gallery directly,
                  no password prompt. */}
              {/* Sneak peek link — completed but not yet delivered. */}
              {!isPhotographer && booking.status === "completed" && booking.peek_token && booking.peek_shared_at && (
                <a
                  href={`/peek/${booking.peek_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 transition hover:bg-violet-100"
                >
                  <span className="text-sm font-semibold text-violet-800">{t("peekReady")}</span>
                  <svg className="h-4 w-4 shrink-0 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              )}
              {!isPhotographer && booking.delivery_token && booking.status === "delivered" && (() => {
                const notExpired = !booking.delivery_expires_at || new Date(booking.delivery_expires_at) > new Date();
                if (!notExpired) return null;
                let pw = "";
                if (booking.delivery_chat_payload?.startsWith("DELIVERY:")) {
                  const parts = booking.delivery_chat_payload.split(":");
                  pw = parts[parts.length - 1] || "";
                }
                const url = `/delivery/${booking.delivery_token}${pw ? `?pw=${encodeURIComponent(pw)}` : ""}`;
                return (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 px-6 py-3.5 text-base font-bold text-white shadow-md transition hover:from-accent-600 hover:to-accent-700"
                  >
                    📸 {booking.delivery_accepted ? t("downloadYourPhotos") : t("seeYourPhotos")}
                  </a>
                );
              })()}

              {/* CLIENT — giant Leave a Review CTA. Yellow gradient + star,
                  full-width on mobile so it can't be missed. The Message link
                  drops below it. */}
              {!isPhotographer && (booking.status === "completed" || booking.status === "delivered") && !booking.has_review && (
                <div className="mt-4">
                  <ReviewForm bookingId={booking.id} photographerName={normalizeName(booking.other_name)} deliveryToken={booking.delivery_token} tipped={!!booking.tip_amount_cents} />
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  href={`/dashboard/messages/${booking.id}`}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  {t("message")}
                </Link>
                {!isPhotographer && (booking.status === "pending" || booking.status === "confirmed") && (
                  <BookingStatusButtons bookingId={booking.id} currentStatus="cancel-only" paymentStatus={booking.payment_status} />
                )}
                {booking.has_review && (
                  <span className="flex items-center gap-1 px-2 text-sm text-green-600">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    {t("reviewed")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center py-16 text-center">
          <svg className="h-12 w-12 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            {isPhotographer ? t("noBookingsPhotographer") : t("noBookingsClient")}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {isPhotographer
              ? t("noBookingsPhotographerDesc")
              : t("noBookingsClientDesc")}
          </p>
          {!isPhotographer && (
            <Link href="/photographers" className="mt-4 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">{t("browsePhotographers")}</Link>
          )}
        </div>
      )}
    </div>
  );
}

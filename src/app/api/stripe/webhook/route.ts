import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { requireStripe, SERVICE_FEE_RATE } from "@/lib/stripe";
import { queryOne } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendEmail, getAdminEmail, sendSubscriptionEmail, sendPaymentReceivedToPhotographer, sendPaymentConfirmedToClient, sendPaymentFailedToClient } from "@/lib/email";
import { sendSMS, sendAdminSMS } from "@/lib/sms";
import { sendTelegram } from "@/lib/telegram";
import { bookingStripePaymentColumnsExist } from "@/lib/booking-stripe-payment-fields";

// Stripe events we surface in the `stripe` Telegram topic. Anything
// not listed (most notably payment_intent.created — fires on every
// "Pay" button click and is pure noise) gets dropped silently.
const STRIPE_EVENTS_TO_FORWARD = new Set<string>([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "transfer.created",
  "transfer.reversed",
  "transfer.failed",
  "payout.created",
  "payout.paid",
  "payout.failed",
  "account.updated",
  "review.opened",
  "radar.early_fraud_warning.created",
]);

function fmtAmount(amountCents: number | null | undefined, currency?: string | null): string {
  if (typeof amountCents !== "number") return "?";
  const symbol = (currency || "").toLowerCase() === "eur" ? "€" : (currency || "").toUpperCase() + " ";
  return `${symbol}${(amountCents / 100).toFixed(2)}`;
}

function paymentAmountFromStripe(amountCents: number | null | undefined, fallbackEuros: number | null | undefined): number {
  if (typeof amountCents === "number") return amountCents / 100;
  // Fallback only fires if Stripe omitted amount_total. `fallbackEuros` is the
  // booking BASE (total_price), but the client is charged the GROSS (base +
  // service fee), so apply the fee here too — never quote bare base as "paid".
  return Math.round(Number(fallbackEuros || 0) * (1 + SERVICE_FEE_RATE) * 100) / 100;
}

function safeTelegramText(value: unknown): string {
  return String(value ?? "").replace(/[<>]/g, "");
}

interface StripeWebhookEvent {
  id: string;
  type: string;
  account?: string;
  data: { object: Record<string, unknown> };
}

// Resolves a Stripe customer ID into a human label like
// "Jose Santos (magicdreams@outlook.pt)". Returns null silently if we can't
// find the photographer — the alert still goes out, just without a name.
async function resolveCustomerLabel(customerId: string | undefined): Promise<string | null> {
  if (!customerId) return null;
  try {
    const row = await queryOne<{ name: string | null; email: string | null; slug: string | null }>(
      `SELECT u.name, u.email, pp.slug
         FROM users u
         LEFT JOIN photographer_profiles pp ON pp.user_id = u.id
        WHERE u.stripe_customer_id = $1
        LIMIT 1`,
      [customerId]
    );
    if (!row) return null;
    const name = String(row.name || "").replace(/[<>]/g, "");
    const email = String(row.email || "").replace(/[<>]/g, "");
    const slug = row.slug ? `/${row.slug}` : "";
    if (name && email) return `${name} (${email})${slug}`;
    if (name) return `${name}${slug}`;
    if (email) return email + slug;
    return null;
  } catch { return null; }
}

// Pulls a friendly subscription-type label ("Verified", "Featured", "Pro
// plan") out of a Stripe subscription by reading its metadata. Falls back
// to the raw price ID only if metadata wasn't set.
async function resolveSubscriptionLabel(subscriptionId: string | undefined): Promise<string | null> {
  if (!subscriptionId) return null;
  try {
    const sub = await requireStripe().subscriptions.retrieve(subscriptionId);
    const md = (sub.metadata || {}) as Record<string, string>;
    if (md.type === "verified") return "✔️ Verified";
    if (md.type === "featured") return "⭐ Featured";
    if (md.plan) return `Plan: ${md.plan}`;
    const item = sub.items?.data?.[0];
    return item?.price?.nickname || item?.price?.id || null;
  } catch { return null; }
}

async function summariseStripeEvent(event: StripeWebhookEvent): Promise<string> {
  const obj = (event.data?.object || {}) as Record<string, unknown>;

  // Russian-flavoured human-readable headlines instead of the raw event types.
  // Each branch returns a tuple [headline, ...detailLines]. Goal: glance at
  // the chat and instantly know what happened without parsing IDs. Booking
  // ID is the only ID we keep (last 8 chars) — it's how we cross-reference
  // with the bookings tab in admin if something looks off.
  const lines: string[] = [];

  const meta = (obj.metadata as Record<string, string>) || {};
  const bookingTail = meta.booking_id ? meta.booking_id.slice(0, 8) : null;
  const customerId = (obj.customer as string | undefined) || undefined;
  const customerLabel = await resolveCustomerLabel(customerId);

  switch (event.type) {
    case "payment_intent.succeeded": {
      // Gift card sales get their own (more informative) admin alert
      // from gift-card-fulfillment — suppress the generic firehose
      // line for them to avoid double-pinging. Caller filters empty
      // headlines and skips the Telegram post entirely.
      if (meta.gift_card_id) return "";
      const amt = fmtAmount(obj.amount as number, obj.currency as string);
      lines.push(`💸 <b>Бабки на базе!</b> Прилетело ${amt}.`);
      if (customerLabel) lines.push(`От: ${customerLabel}`);
      if (bookingTail) lines.push(`Букинг: <code>${bookingTail}</code>`);
      break;
    }
    case "payment_intent.payment_failed": {
      const amt = fmtAmount(obj.amount as number, obj.currency as string);
      const err = obj.last_payment_error as { message?: string } | undefined;
      lines.push(`❌ <b>Не прошла оплата</b> на ${amt}. У клиента беда с картой.`);
      if (err?.message) lines.push(`<i>${String(err.message).slice(0, 180)}</i>`);
      if (bookingTail) lines.push(`Букинг: <code>${bookingTail}</code>`);
      break;
    }
    case "charge.refunded": {
      const amt = fmtAmount(obj.amount_refunded as number, obj.currency as string);
      lines.push(`↩️ <b>Вернули</b> клиенту ${amt}.`);
      if (bookingTail) lines.push(`Букинг: <code>${bookingTail}</code>`);
      break;
    }
    case "charge.dispute.created": {
      const amt = fmtAmount(obj.amount as number, obj.currency as string);
      lines.push(`🚨 <b>ЧАРДЖБЭК!</b> Клиент оспорил ${amt}.`);
      if (obj.reason) lines.push(`Причина: ${String(obj.reason)}`);
      lines.push(`⏰ Срочно отвечать в Stripe до дедлайна, иначе деньги уйдут.`);
      break;
    }
    case "checkout.session.completed": {
      const total = fmtAmount(obj.amount_total as number, obj.currency as string);
      const mode = obj.mode as string | undefined;
      if (mode === "subscription") {
        // Pull the type label off the subscription so the alert says
        // "Verified" / "Featured" / "Pro plan" instead of a vague headline.
        const subId = obj.subscription as string | undefined;
        const subLabel = await resolveSubscriptionLabel(subId);
        const what = subLabel || "подписку";
        lines.push(`🛒 <b>Оформляют ${what}</b> за ${total}.`);
      } else if (meta.type === "verified" || meta.type === "featured") {
        lines.push(`🛒 <b>Фотограф купил ${meta.type === "verified" ? "галочку Verified" : "Featured"}</b> за ${total}. 🎉`);
      } else {
        lines.push(`🛒 <b>Клиент дошёл до checkout</b> на ${total}. Сейчас прилетит payment_intent.`);
      }
      if (customerLabel) lines.push(`Кто: ${customerLabel}`);
      if (meta.type && mode !== "subscription") lines.push(`Тип: ${meta.type}`);
      if (bookingTail) lines.push(`Букинг: <code>${bookingTail}</code>`);
      break;
    }
    case "customer.subscription.created": {
      // Prefer metadata.type (set by /api/stripe/{verified,featured,subscription})
      // — that's the human label. Price nickname / id is the fallback.
      const subMd = (obj.metadata as Record<string, string>) || {};
      let what: string;
      if (subMd.type === "verified") what = "✔️ Verified";
      else if (subMd.type === "featured") what = "⭐ Featured";
      else if (subMd.plan) what = `Plan: ${subMd.plan}`;
      else {
        const items = (obj.items as { data?: Array<{ price?: { id?: string; nickname?: string } }> } | undefined)?.data || [];
        what = items.map((it) => it.price?.nickname || it.price?.id).filter(Boolean).join(", ") || "?";
      }
      lines.push(`🆕 <b>Новый подписчик: ${what}</b>`);
      if (customerLabel) lines.push(`Кто: ${customerLabel}`);
      break;
    }
    case "customer.subscription.updated": {
      const subMd = (obj.metadata as Record<string, string>) || {};
      let what: string;
      if (subMd.type === "verified") what = "✔️ Verified";
      else if (subMd.type === "featured") what = "⭐ Featured";
      else if (subMd.plan) what = `Plan: ${subMd.plan}`;
      else {
        const items = (obj.items as { data?: Array<{ price?: { id?: string; nickname?: string } }> } | undefined)?.data || [];
        what = items.map((it) => it.price?.nickname || it.price?.id).filter(Boolean).join(", ") || "?";
      }
      const status = obj.status as string | undefined;
      const cancelAtEnd = obj.cancel_at_period_end === true;
      if (cancelAtEnd) lines.push(`🚪 <b>Отменили на конец периода:</b> ${what}`);
      else lines.push(`🔄 <b>Подписка обновлена:</b> ${what}. Статус: ${status}.`);
      if (customerLabel) lines.push(`Кто: ${customerLabel}`);
      break;
    }
    case "customer.subscription.deleted": {
      const subMd = (obj.metadata as Record<string, string>) || {};
      const what = subMd.type === "verified" ? "✔️ Verified"
        : subMd.type === "featured" ? "⭐ Featured"
        : subMd.plan ? `Plan: ${subMd.plan}` : "подписка";
      lines.push(`👋 <b>${what} — закончилась.</b> Кто-то слился.`);
      if (customerLabel) lines.push(`Кто: ${customerLabel}`);
      break;
    }
    case "invoice.payment_succeeded": {
      const amt = fmtAmount(obj.amount_paid as number || obj.amount_due as number, obj.currency as string);
      const reason = obj.billing_reason as string | undefined;
      const subLabel = await resolveSubscriptionLabel(obj.subscription as string | undefined);
      const what = subLabel ? ` за ${subLabel}` : "";
      if (reason === "subscription_cycle") lines.push(`📅 <b>Списалось${what}:</b> ${amt}`);
      else if (reason === "subscription_create") lines.push(`📅 <b>Первый счёт оплачен${what}:</b> ${amt}`);
      else lines.push(`📄 <b>Инвойс оплачен${what}:</b> ${amt}`);
      if (customerLabel) lines.push(`Кто: ${customerLabel}`);
      break;
    }
    case "invoice.payment_failed": {
      const amt = fmtAmount(obj.amount_due as number, obj.currency as string);
      const subLabel = await resolveSubscriptionLabel(obj.subscription as string | undefined);
      const what = subLabel ? ` (${subLabel})` : "";
      lines.push(`📅❌ <b>Списание не прошло${what}:</b> ${amt}`);
      if (customerLabel) lines.push(`Кто: ${customerLabel}`);
      lines.push(`Пнуть фотографа обновить карту.`);
      break;
    }
    case "transfer.created": {
      const amt = fmtAmount(obj.amount as number, obj.currency as string);
      lines.push(`💸 <b>Отправили фотографу</b> ${amt}.`);
      if (bookingTail) lines.push(`Букинг: <code>${bookingTail}</code>`);
      break;
    }
    case "transfer.reversed": {
      const amt = fmtAmount(obj.amount as number, obj.currency as string);
      lines.push(`↪️ <b>Вернули перевод</b> на ${amt} обратно на платформу.`);
      if (bookingTail) lines.push(`Букинг: <code>${bookingTail}</code>`);
      break;
    }
    case "transfer.failed": {
      const amt = fmtAmount(obj.amount as number, obj.currency as string);
      lines.push(`🚫 <b>Перевод фотографу зафейлился</b> на ${amt}. Глянь его Stripe-аккаунт.`);
      if (bookingTail) lines.push(`Букинг: <code>${bookingTail}</code>`);
      break;
    }
    case "payout.created": {
      const amt = fmtAmount(obj.amount as number, obj.currency as string);
      lines.push(`🏦 <b>Stripe готовит выплату фотографу</b>: ${amt}. Скоро должно упасть на карту.`);
      break;
    }
    case "payout.paid": {
      const amt = fmtAmount(obj.amount as number, obj.currency as string);
      lines.push(`✅ <b>Фотограф получил деньги!</b> ${amt} на карте/счёте.`);
      break;
    }
    case "payout.failed": {
      const amt = fmtAmount(obj.amount as number, obj.currency as string);
      const reason = obj.failure_message as string | undefined;
      lines.push(`🚫 <b>Payout фотографу не прошёл</b>: ${amt}.`);
      if (reason) lines.push(`<i>${String(reason).slice(0, 180)}</i>`);
      lines.push(`Сказать фотографу проверить банковские реквизиты.`);
      break;
    }
    case "account.updated": {
      const charges = obj.charges_enabled as boolean | undefined;
      const payouts = obj.payouts_enabled as boolean | undefined;
      const submitted = obj.details_submitted as boolean | undefined;
      const requirements = obj.requirements as { disabled_reason?: string | null; currently_due?: string[] } | undefined;
      if (submitted && charges && payouts) {
        lines.push(`👤✅ <b>Фотограф закончил Stripe-онбординг</b> — может получать деньги.`);
      } else if (requirements?.disabled_reason) {
        lines.push(`👤⚠️ <b>Stripe заблокировал фотографа.</b> Причина: ${requirements.disabled_reason}`);
        if (requirements.currently_due?.length) {
          lines.push(`Не хватает: ${requirements.currently_due.slice(0, 5).join(", ")}`);
        }
      } else {
        lines.push(`👤 <b>Фотограф что-то поменял в Stripe-аккаунте.</b>`);
        lines.push(`Charges: ${charges ? "✅" : "❌"} · Payouts: ${payouts ? "✅" : "❌"} · Submitted: ${submitted ? "✅" : "❌"}`);
      }
      break;
    }
    case "review.opened": {
      lines.push(`🔍 <b>Stripe открыл review</b> по транзакции.`);
      if (obj.reason) lines.push(`Причина: ${String(obj.reason)}`);
      lines.push(`Глянь в Stripe dashboard, возможно нужны действия.`);
      break;
    }
    case "radar.early_fraud_warning.created": {
      lines.push(`🚨 <b>БАНК ПОДОЗРЕВАЕТ МОШЕННИЧЕСТВО</b> по платежу.`);
      if (obj.fraud_type) lines.push(`Тип: ${String(obj.fraud_type)}`);
      lines.push(`Срочно: вернуть деньги клиенту или собирать доказательства, иначе будет чарджбэк.`);
      break;
    }
    default:
      // Fallback for any new event we haven't customised yet.
      lines.push(`📌 <b>${event.type}</b>`);
      break;
  }

  return lines.join("\n");
}

async function forwardStripeEventToTelegram(event: StripeWebhookEvent): Promise<void> {
  if (!STRIPE_EVENTS_TO_FORWARD.has(event.type)) return;
  const summary = await summariseStripeEvent(event);
  // Skip empty summaries — summariseStripeEvent uses "" as a sentinel
  // for "this event has its own dedicated alert path, don't double-post"
  // (e.g. gift card payment success).
  if (!summary.trim()) return;
  await sendTelegram(summary, "stripe");
}

async function notifyAdminSubscriptionEvent(
  photographerId: string,
  emoji: string,
  title: string,
  detail: string,
) {
  try {
    const info = await queryOne<{ name: string; email: string; slug: string }>(
      `SELECT u.name, u.email, pp.slug FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.id = $1`,
      [photographerId]
    );
    if (!info) return;
    const safeName = String(info.name || "").replace(/[<>]/g, "");
    const safeEmail = String(info.email || "").replace(/[<>]/g, "");
    const safeDetail = detail.replace(/[<>]/g, "");
    await sendTelegram(
      `${emoji} <b>${title}</b>\n\nName: ${safeName}\nEmail: ${safeEmail}\n${safeDetail}\n\n👉 <a href="https://photoportugal.com/admin#${info.slug}">View in Admin</a>`,
      "photographers"
    );
  } catch (e) {
    console.error("[webhook] telegram subscription notify failed:", e);
  }
}

async function getCheckoutPaymentSummary(
  checkoutSession: Record<string, unknown>,
): Promise<{
  amountDiscount: number;
  amountSubtotal: number | null;
  amountTotal: number | null;
  currency: string | null;
  code: string | null;
  couponName: string | null;
  percentOff: number | null;
}> {
  const amountDiscount = (checkoutSession.total_details as { amount_discount?: number } | null | undefined)?.amount_discount || 0;
  let expandedSession = checkoutSession;
  const sessionId = typeof checkoutSession.id === "string" ? checkoutSession.id : null;

  if (amountDiscount > 0 && sessionId) {
    try {
      expandedSession = await requireStripe().checkout.sessions.retrieve(sessionId, {
        expand: ["discounts", "discounts.promotion_code", "discounts.coupon"],
      } as never) as unknown as Record<string, unknown>;
    } catch (err) {
      console.error("[webhook] checkout discount expand failed:", err);
    }
  }

  const discounts = Array.isArray(expandedSession.discounts) ? expandedSession.discounts : [];
  const firstDiscount = discounts[0] as Record<string, unknown> | undefined;
  const promotionCode = firstDiscount?.promotion_code && typeof firstDiscount.promotion_code === "object"
    ? firstDiscount.promotion_code as Record<string, unknown>
    : null;
  const coupon = firstDiscount?.coupon && typeof firstDiscount.coupon === "object"
    ? firstDiscount.coupon as Record<string, unknown>
    : null;

  return {
    amountDiscount,
    amountSubtotal: typeof expandedSession.amount_subtotal === "number" ? expandedSession.amount_subtotal : null,
    amountTotal: typeof expandedSession.amount_total === "number" ? expandedSession.amount_total : null,
    currency: typeof expandedSession.currency === "string" ? expandedSession.currency : null,
    code: typeof promotionCode?.code === "string" ? promotionCode.code : null,
    couponName: typeof coupon?.name === "string" ? coupon.name : null,
    percentOff: typeof coupon?.percent_off === "number" ? coupon.percent_off : null,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const stripeClient = requireStripe();

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(body, sig!, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Stripe activity firehose ───────────────────────────────────
  // Forward a one-line summary of every event we care about into the
  // dedicated `stripe` Telegram topic. Independent of the business
  // logic below — runs first, fire-and-forget so a Telegram outage
  // can't break payment processing.
  forwardStripeEventToTelegram(event as unknown as StripeWebhookEvent).catch((e) =>
    console.error("[webhook] stripe firehose telegram failed:", e)
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object;
        const bookingId = checkoutSession.metadata?.booking_id;
        const checkoutType = checkoutSession.metadata?.type;
        const meta = (checkoutSession.metadata || {}) as Record<string, string>;

        if (meta.source === "makealbum" && meta.pp_checkout_id) {
          // MakeAlbum album purchase — record payment + fire signed webhook
          // back to MakeAlbum so they can start production. We don't bail
          // on missing fields here; the outbound webhook helper will log
          // a structured error against the row.
          const { deliverMakeAlbumWebhook } = await import("@/lib/makealbum/webhook");
          // Stripe Checkout sessions surface a few extra keys not in our
          // local Session type; cast through unknown so we can read the
          // shipping + customer details collected during the hosted flow.
          const csAny = checkoutSession as unknown as {
            shipping_details?: { name?: string; address?: { line1?: string; line2?: string; city?: string; postal_code?: string; country?: string; state?: string } } | null;
            customer_details?: { email?: string; phone?: string } | null;
          };
          const ship = csAny.shipping_details || {};
          const customer = csAny.customer_details || {};
          const paymentIntentId = (typeof checkoutSession.payment_intent === "string"
            ? checkoutSession.payment_intent
            : (checkoutSession.payment_intent as { id?: string } | null)?.id) || "";

          await queryOne(
            `UPDATE makealbum_orders
                SET status                  = 'paid',
                    paid_at                 = NOW(),
                    stripe_payment_intent_id = $2,
                    shipping_address        = $3::jsonb
              WHERE id = $1
              RETURNING id`,
            [
              meta.pp_checkout_id,
              paymentIntentId,
              JSON.stringify({
                name: ship.name || "",
                line1: ship.address?.line1 || "",
                line2: ship.address?.line2 || "",
                city: ship.address?.city || "",
                postalCode: ship.address?.postal_code || "",
                countryCode: ship.address?.country || "",
                state: ship.address?.state || "",
                phone: customer.phone || "",
                email: customer.email || "",
              }),
            ],
          ).catch((e) => console.error("[webhook] makealbum row update failed:", e));

          // Outbound delivery is fire-and-log; we don't block the Stripe
          // webhook on MakeAlbum's responsiveness.
          deliverMakeAlbumWebhook(
            meta.webhook_url,
            {
              event: "album.paid",
              orderId: meta.makealbum_order_id,
              albumId: meta.makealbum_album_id,
              checkoutId: meta.pp_checkout_id,
              paymentId: paymentIntentId,
              amountCents: Number(checkoutSession.amount_total ?? 0),
              currency: ((checkoutSession.currency as string) || "eur").toUpperCase(),
              shippingAddress: {
                name: ship.name || "",
                line1: ship.address?.line1 || "",
                line2: ship.address?.line2 || "",
                city: ship.address?.city || "",
                postalCode: ship.address?.postal_code || "",
                countryCode: ship.address?.country || "",
                state: ship.address?.state || "",
                phone: customer.phone || "",
                email: customer.email || "",
              },
            },
            meta.pp_checkout_id,
          ).catch((e) => console.error("[webhook] makealbum delivery error:", e));

          console.log(`[webhook] MakeAlbum album paid: ${meta.pp_checkout_id} (order=${meta.makealbum_order_id})`);
        } else if (checkoutType === "verified") {
          // Verified badge payment completed — activate badge
          const photographerId = checkoutSession.metadata?.photographer_id;
          if (photographerId) {
            await queryOne(
              "UPDATE photographer_profiles SET is_verified = TRUE WHERE id = $1 RETURNING id",
              [photographerId]
            );
            console.log(`[webhook] Verified badge activated for photographer ${photographerId}`);
          }
        } else if (checkoutType === "tip") {
          // ── Tip payment completed ─────────────────────────────────
          // Client tipped the photographer post-delivery. Mark the tip
          // paid (idempotent), then transfer the photographer's 90% via
          // Connect (platform keeps 10% — covers Stripe processing).
          // Same atomic-claim + idempotency pattern as the delivery
          // payout in /api/delivery/[token]/accept.
          const tipId = checkoutSession.metadata?.tip_id;
          if (tipId) {
            const tipPi = typeof checkoutSession.payment_intent === "string"
              ? checkoutSession.payment_intent
              : (checkoutSession.payment_intent as { id?: string } | null)?.id || null;
            const tip = await queryOne<{
              id: string; booking_id: string; amount_cents: number; payout_cents: number;
            }>(
              `UPDATE tips SET status = 'paid', paid_at = NOW(), stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id)
                WHERE id = $1 AND status = 'pending'
                RETURNING id, booking_id, amount_cents, payout_cents`,
              [tipId, tipPi]
            );
            if (tip) {
              const ctx = await queryOne<{
                photographer_stripe_id: string | null;
                stripe_ready: boolean;
                photographer_email: string;
                photographer_name: string;
                photographer_user_id: string;
                client_id: string;
                client_name: string;
              }>(
                `SELECT pp.stripe_account_id as photographer_stripe_id,
                        COALESCE(pp.stripe_onboarding_complete, FALSE) as stripe_ready,
                        pu.email as photographer_email, pu.name as photographer_name,
                        pu.id as photographer_user_id,
                        b.client_id, cu.name as client_name
                 FROM bookings b
                 JOIN photographer_profiles pp ON pp.id = b.photographer_id
                 JOIN users pu ON pu.id = pp.user_id
                 JOIN users cu ON cu.id = b.client_id
                 WHERE b.id = $1`,
                [tip.booking_id]
              );
              const tipEur = (tip.amount_cents / 100).toFixed(2);
              const payoutEur = (tip.payout_cents / 100).toFixed(2);

              // Transfer the photographer's share when Stripe is ready;
              // otherwise leave transferred=FALSE and alert admin (the tip
              // sits on the platform balance until manually retried).
              if (ctx?.photographer_stripe_id && ctx.stripe_ready) {
                const claim = await queryOne<{ id: string }>(
                  "UPDATE tips SET transferred = TRUE WHERE id = $1 AND transferred = FALSE RETURNING id",
                  [tip.id]
                );
                if (claim) {
                  try {
                    await requireStripe().transfers.create({
                      amount: tip.payout_cents,
                      currency: "eur",
                      destination: ctx.photographer_stripe_id,
                      ...(tipPi ? { transfer_group: tipPi } : {}),
                      metadata: { tip_id: tip.id, booking_id: tip.booking_id, type: "tip_payout" },
                    }, { idempotencyKey: `tip_transfer_${tip.id}` });
                  } catch (trErr) {
                    // Roll the claim back so a retry can re-attempt.
                    await queryOne("UPDATE tips SET transferred = FALSE WHERE id = $1 RETURNING id", [tip.id]).catch(() => {});
                    console.error("[webhook] tip transfer error:", trErr);
                  }
                }
              } else {
                import("@/lib/telegram").then(({ sendTelegram }) =>
                  sendTelegram(`⚠️ <b>Tip received but photographer Stripe not ready</b>\nTip: €${tipEur} (payout €${payoutEur})\nBooking: <code>${tip.booking_id.slice(0, 8)}</code>\nTransfer manually once onboarding completes.`, "stripe")
                ).catch(() => {});
              }

              if (ctx) {
                const clientFirst = ctx.client_name.split(" ")[0] || ctx.client_name;
                const photogFirst = ctx.photographer_name.split(" ")[0] || ctx.photographer_name;
                // Warm chat message in the shared thread (plain text — renders
                // on every app version, unlike typed payloads).
                await queryOne(
                  `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE) RETURNING id`,
                  [tip.booking_id, ctx.client_id, `💛 ${clientFirst} left a €${tipEur} tip — thank you!`]
                ).catch((e) => console.error("[webhook] tip chat message error:", e));

                // Email the photographer — honest about the 10% platform cut.
                import("@/lib/email").then(({ sendEmail }) =>
                  sendEmail(
                    ctx.photographer_email,
                    `💛 ${clientFirst} left you a €${tipEur} tip`,
                    `<div style="font-family: sans-serif; max-width: 540px; margin: 0 auto;">
                      <h2 style="color:#D97706;">You got a tip! 💛</h2>
                      <p>Hi ${photogFirst},</p>
                      <p><strong>${ctx.client_name.replace(/[<>]/g, "")}</strong> loved your photos so much they added a <strong style="color:#D97706;">€${tipEur}</strong> tip.</p>
                      <p><strong>€${payoutEur}</strong> is on its way to your Stripe account (after the 10% platform fee) and will arrive with your regular payout schedule.</p>
                      <p>Moments like this deserve a reply — a quick thank-you in the chat goes a long way.</p>
                      <p><a href="https://photoportugal.com/dashboard/messages" style="display:inline-block;background:#D97706;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Say thanks →</a></p>
                      <p style="color:#999;font-size:12px;">Photo Portugal — photoportugal.com</p>
                    </div>`
                  )
                ).catch((e) => console.error("[webhook] tip email error:", e));

                import("@/lib/telegram").then(({ sendTelegram }) =>
                  sendTelegram(`💛 <b>Tip!</b> ${clientFirst} → ${photogFirst}: €${tipEur} (payout €${payoutEur}, platform €${((tip.amount_cents - tip.payout_cents) / 100).toFixed(2)})\nBooking: <code>${tip.booking_id.slice(0, 8)}</code>`, "bookings")
                ).catch(() => {});
              }
            }
          }
        } else if ((checkoutType === "booking" || bookingId) && checkoutSession.payment_intent) {
          // Booking payment completed
          const paymentSummary = await getCheckoutPaymentSummary(checkoutSession as unknown as Record<string, unknown>);
          const paidAmountLabel = typeof paymentSummary.amountTotal === "number"
            ? fmtAmount(paymentSummary.amountTotal, paymentSummary.currency)
            : null;
          // Guard against Stripe webhook replays: only flip to paid for
          // bookings still in a payable state.
          await queryOne(
            `UPDATE bookings SET stripe_payment_intent_id = $1, payment_status = 'paid'
             WHERE id = $2 AND status = 'confirmed' RETURNING id`,
            [checkoutSession.payment_intent, bookingId]
          );

          // Blind booking — auth-hold authorised, NOT captured yet.
          // Marker: photographer_id IS NULL + blind_booking=TRUE.
          // Stamp the 24h deadline by which an admin must assign a
          // photographer (and trigger capture) or the auto-refund cron
          // will void this PaymentIntent.
          const blindCheck = await queryOne<{ blind_booking: boolean; photographer_id: string | null; total_price: number | null; status: string }>(
            "SELECT blind_booking, photographer_id, total_price, status::text as status FROM bookings WHERE id = $1",
            [bookingId]
          );
          if (blindCheck?.blind_booking && !blindCheck.photographer_id && blindCheck.status === "confirmed") {
            await queryOne(
              `UPDATE bookings SET auto_refund_at = NOW() + INTERVAL '24 hours'
                WHERE id = $1 AND status = 'confirmed' AND photographer_id IS NULL RETURNING id`,
              [bookingId]
            );
            // Summer offer: total_price is the derived photographer BASE
            // (inclusive × 0.85); reconstruct the client's all-in charge as
            // base / 0.85 — matches the exact Stripe auth amount.
            const baseEur = blindCheck.total_price ? Number(blindCheck.total_price) : 0;
            const totalEur = Math.round(baseEur / 0.85);
            const amtLabel = baseEur
              ? `€${totalEur} all-in (base €${baseEur} → photographer, cut €${Math.round((totalEur - baseEur) * 100) / 100})`
              : "(no price)";
            import("@/lib/telegram").then(({ sendTelegram }) =>
              sendTelegram(
                `<b>🎯 Blind booking authorised — needs admin assignment</b>\nBooking: <code>${bookingId}</code>\nAmount: ${amtLabel} (auth-hold, not captured)\nDeadline: 24h to assign a photographer or auto-refund.\n<a href="https://photoportugal.com/admin">Open admin queue</a>`,
                "bookings"
              )
            ).catch((err) => console.error("[webhook] blind-booking telegram error:", err));

            // Send client confirmation — INNER JOIN photographer_profiles
            // skips blind rows (audit finding #1), so we email here.
            import("@/lib/email").then(async ({ sendEmail }) => {
              const ctx = await queryOne<{ email: string; name: string; location_slug: string | null; shoot_date: string | null }>(
                `SELECT u.email, u.name, b.location_slug, b.shoot_date::text
                   FROM bookings b JOIN users u ON u.id = b.client_id WHERE b.id = $1`,
                [bookingId]
              );
              if (!ctx?.email) return;
              const BASE = process.env.AUTH_URL || "https://photoportugal.com";
              // Show the all-in amount the client's card is authorised for.
              // total_price holds the derived photographer base (summer
              // offer: inclusive × 0.85), so client total = base / 0.85 —
              // matches the exact Stripe auth (€279/465/649).
              const priceText = blindCheck.total_price ? `€${Math.round(Number(blindCheck.total_price) / 0.85)}` : "your booking";
              await sendEmail(
                ctx.email,
                "We've got your booking — finding your photographer now",
                `<div style="font-family: sans-serif; max-width: 540px; margin: 0 auto;">
                  <h2 style="color:#C94536;">Booking received 🎉</h2>
                  <p>Hi ${(ctx.name.split(" ")[0] || ctx.name).replace(/[<>]/g, "")},</p>
                  <p>Your ${ctx.location_slug || "Portugal"} photoshoot ${ctx.shoot_date ? `on ${ctx.shoot_date}` : ""} is authorised (${priceText}). Our team is hand-picking the right photographer for you and will confirm within 24 hours by email.</p>
                  <p>You'll only be charged once we confirm your photographer. If we can't match you in time, the hold is released automatically.</p>
                  <p><a href="${BASE}/dashboard/bookings" style="display:inline-block;background:#C94536;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">View your booking</a></p>
                  <p style="color:#999;font-size:12px;">Photo Portugal — photoportugal.com</p>
                </div>`
              );
            }).catch((err) => console.error("[webhook] blind-booking client email error:", err));
          }
          if (await bookingStripePaymentColumnsExist()) {
            queryOne(
              `UPDATE bookings
                  SET stripe_amount_subtotal_cents = $1,
                      stripe_amount_paid_cents = $2,
                      stripe_amount_discount_cents = $3,
                      stripe_currency = $4,
                      stripe_promo_code = $5,
                      stripe_coupon_name = $6,
                      stripe_coupon_percent_off = $7
                WHERE id = $8
                RETURNING id`,
              [
                paymentSummary.amountSubtotal,
                paymentSummary.amountTotal,
                paymentSummary.amountDiscount,
                paymentSummary.currency,
                paymentSummary.code,
                paymentSummary.couponName,
                paymentSummary.percentOff,
                bookingId,
              ]
            ).catch((err) => console.error("[webhook] failed to persist Stripe payment details:", err));
          }
          console.log(`[webhook] Checkout completed for booking ${bookingId}, PI: ${checkoutSession.payment_intent}`);

          // Concierge attribution: stamp paid_at on rec events for the
          // chat that surfaced this photographer. Uses the already-
          // persisted bookings.concierge_chat_id link (written by
          // bookings/route.ts and the inquiries attribution patch).
          // Fire-and-forget — telemetry must not block the user flow.
          void (async () => {
            try {
              const row = await queryOne<{ concierge_chat_id: string | null; photographer_id: string }>(
                "SELECT concierge_chat_id, photographer_id FROM bookings WHERE id = $1",
                [bookingId]
              );
              if (row?.concierge_chat_id && row.photographer_id) {
                const { markPaidFromConcierge } = await import("@/lib/concierge/recommendation-events");
                await markPaidFromConcierge(row.concierge_chat_id, row.photographer_id);
              }
            } catch (err) {
              console.error("[webhook] concierge paid_at attribution failed:", err);
            }
          })();

          // Add system message to chat
          try {
            const bookingForMsg = await queryOne<{ client_id: string; client_name: string; client_phone: string | null; total_price: number }>(
              `SELECT b.client_id, cu.name as client_name, cu.phone as client_phone, b.total_price
               FROM bookings b JOIN users cu ON cu.id = b.client_id WHERE b.id = $1`,
              [bookingId]
            );
            if (bookingForMsg) {
              const firstName = bookingForMsg.client_name?.split(" ")[0] || "Client";
              const phoneNote = bookingForMsg.client_phone ? `\n\nClient phone: ${bookingForMsg.client_phone}` : "";
              const displayAmount = paidAmountLabel || `€${Number(bookingForMsg.total_price)}`;
              await queryOne(
                `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE) RETURNING id`,
                [bookingId, bookingForMsg.client_id,
                  `✅ Payment of ${displayAmount} received from ${firstName}.${phoneNote}`]
              );
            }
          } catch (msgErr) {
            console.error("[webhook] system message error:", msgErr);
          }

          // Upload "Payment Completed" offline conversion to Google Ads
          try {
            const gclidBooking = await queryOne<{ gclid: string | null; total_price: number; client_email: string | null; client_phone: string | null }>(
              `SELECT b.gclid, b.total_price, u.email as client_email, u.phone as client_phone
               FROM bookings b JOIN users u ON u.id = b.client_id WHERE b.id = $1`,
              [bookingId]
            );
            if (gclidBooking?.gclid) {
              const conversionValue = paymentAmountFromStripe(paymentSummary.amountTotal, gclidBooking.total_price);
              const { uploadPaymentCompletedConversion } = await import("@/lib/google-ads-conversions");
              await uploadPaymentCompletedConversion(gclidBooking.gclid, conversionValue, {
                email: gclidBooking.client_email,
                phone: gclidBooking.client_phone,
              }, `booking:${bookingId}:paid`);
            }
          } catch (gadsErr) {
            console.error("[webhook] gads conversion lookup error:", gadsErr);
          }

          // Send payment notification emails
          try {
            const bookingInfo = await queryOne<{
              client_email: string; client_name: string; client_phone: string | null;
              photographer_email: string; photographer_name: string;
              total_price: number; payout_amount: string | null; platform_fee: string | null;
            }>(
              `SELECT cu.email as client_email, cu.name as client_name, cu.phone as client_phone,
                      pu.email as photographer_email, pu.name as photographer_name,
                      b.total_price, b.payout_amount, b.platform_fee
               FROM bookings b
               JOIN users cu ON cu.id = b.client_id
               JOIN photographer_profiles pp ON pp.id = b.photographer_id
               JOIN users pu ON pu.id = pp.user_id
               WHERE b.id = $1`,
              [bookingId]
            );
            if (bookingInfo) {
              const paidAmount = paymentAmountFromStripe(paymentSummary.amountTotal, bookingInfo.total_price);
              const displayPaidAmount = paidAmountLabel || `€${Number(bookingInfo.total_price)}`;
              // Photographer-facing notifications must show the PAYOUT (what
              // they actually receive), not the gross the client paid — the
              // gross includes the client-side service fee and confuses
              // photographers (Isa thought €592.25 was hers when her payout
              // was €463.50). Admin + client notifications keep the gross.
              const payoutEur = bookingInfo.payout_amount != null
                ? Number(bookingInfo.payout_amount)
                : Number(bookingInfo.total_price) - Number(bookingInfo.platform_fee || 0);
              const payoutLabel = `€${Number.isInteger(payoutEur) ? payoutEur : payoutEur.toFixed(2)}`;
              sendPaymentReceivedToPhotographer(
                bookingInfo.photographer_email,
                bookingInfo.photographer_name,
                bookingInfo.client_name,
                bookingId!,
                payoutEur,
                bookingInfo.client_phone
              );
              sendPaymentConfirmedToClient(
                bookingInfo.client_email,
                bookingInfo.client_name,
                bookingInfo.photographer_name,
                paidAmount
              );
              // Admin notification
              try {
                const adminEmail = await getAdminEmail();
                const adminEmails = adminEmail.split(",").map((e: string) => e.trim()).filter(Boolean);
                for (const email of adminEmails) {
                  sendEmail(
                    email,
                    `Payment received — ${displayPaidAmount} from ${bookingInfo.client_name}`,
                    `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                      <h2 style="color: #16a34a;">Payment Received</h2>
                      <p><strong>${bookingInfo.client_name}</strong> paid <strong>${displayPaidAmount}</strong> for a booking with <strong>${bookingInfo.photographer_name}</strong>.</p>
                      <p><a href="https://photoportugal.com/admin" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View in Admin</a></p>
                    </div>`
                  );
                }
              } catch {}

              // WhatsApp/SMS to all admin phones
              sendAdminSMS(
                `Photo Portugal: ${displayPaidAmount} payment received! ${bookingInfo.client_name} → ${bookingInfo.photographer_name}`
              );
              import("@/lib/telegram").then(({ sendTelegram }) => {
                sendTelegram(`💰 <b>Payment Received!</b>\n\n<b>Amount:</b> ${displayPaidAmount}\n<b>Client:</b> ${bookingInfo!.client_name}\n<b>Photographer:</b> ${bookingInfo!.photographer_name}`, "bookings");
              }).catch((err) => console.error("[webhook] telegram payment error:", err));

              Promise.resolve(paymentSummary).then((discount) => {
                if (discount.amountDiscount <= 0) return;
                const lines = [
                  "🎟 <b>Coupon Used!</b>",
                  "",
                  `<b>Discount:</b> ${fmtAmount(discount.amountDiscount, discount.currency)}`,
                  `<b>Client:</b> ${safeTelegramText(bookingInfo!.client_name)}`,
                  `<b>Photographer:</b> ${safeTelegramText(bookingInfo!.photographer_name)}`,
                ];
                if (discount.code) lines.splice(2, 0, `<b>Code:</b> ${safeTelegramText(discount.code)}`);
                if (discount.percentOff) lines.push(`<b>Percent:</b> ${discount.percentOff}%`);
                if (discount.couponName) lines.push(`<b>Coupon:</b> ${safeTelegramText(discount.couponName)}`);
                if (discount.amountSubtotal !== null) lines.push(`<b>Before discount:</b> ${fmtAmount(discount.amountSubtotal, discount.currency)}`);
                if (discount.amountTotal !== null) lines.push(`<b>Paid in Stripe:</b> ${fmtAmount(discount.amountTotal, discount.currency)}`);
                if (bookingId) lines.push(`<b>Booking:</b> ${safeTelegramText(String(bookingId).slice(0, 8))}`);

                return sendTelegram(lines.join("\n"), "bookings");
              }).catch((err) => console.error("[webhook] telegram coupon payment error:", err));

              // WhatsApp/SMS to photographer
              try {
                const photographerUser = await queryOne<{ phone: string | null; id: string }>(
                  `SELECT u.phone, u.id FROM users u
                   JOIN photographer_profiles pp ON pp.user_id = u.id
                   JOIN bookings b ON b.photographer_id = pp.id
                   WHERE b.id = $1`,
                  [bookingId]
                );
                if (photographerUser?.phone) {
                  const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
                    "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
                    [photographerUser.id]
                  );
                  if (smsPrefs?.sms_bookings !== false) {
                    sendSMS(
                      photographerUser.phone,
                      `Photo Portugal: ${bookingInfo.client_name.split(" ")[0]} paid for your booking. Your payout: ${payoutLabel}. Log in to view details.`
                    ).catch(err => console.error("[sms] error:", err));
                  }
                }
                // Push to photographer — fires regardless of phone, lets
                // photographers without SMS prefs still hear about money.
                if (photographerUser?.id) {
                  const clientFirst = (bookingInfo.client_name || "").split(" ")[0] || "A client";
                  import("@/lib/push").then(m =>
                    m.sendPushNotification(
                      photographerUser.id,
                      `💰 ${payoutLabel} payout from ${clientFirst}`,
                      "Booking is confirmed — tap to view.",
                      { type: "booking", bookingId: bookingId || "", channelId: "payments", categoryId: "PAYMENT" }
                    )
                  ).catch(err => console.error("[webhook] payment push error:", err));
                  import("@/lib/realtime").then((m) =>
                    m.notifyUser(photographerUser.id, "payment_received", { bookingId })
                  );
                }
              } catch (smsErr) {
                console.error("[webhook] payment whatsapp/sms error:", smsErr);
              }

              // Push to client — payment confirmation tap-through to
              // booking detail.
              try {
                const clientUser = await queryOne<{ id: string }>(
                  "SELECT client_id as id FROM bookings WHERE id = $1",
                  [bookingId]
                );
                if (clientUser?.id) {
                  const photogFirst = (bookingInfo.photographer_name || "").split(" ")[0] || "your photographer";
                  import("@/lib/push").then(m =>
                    m.sendPushNotification(
                      clientUser.id,
                      `✅ Your booking with ${photogFirst} is confirmed`,
                      "Payment received. Tap to view details.",
                      { type: "booking", bookingId: bookingId || "", channelId: "bookings", categoryId: "BOOKING" }
                    )
                  ).catch(err => console.error("[webhook] client payment push error:", err));
                  import("@/lib/realtime").then((m) =>
                    m.notifyUser(clientUser.id, "payment_received", { bookingId })
                  );
                }
              } catch {}

              // Telegram notification to photographer
              try {
                const photographerProfileId = await queryOne<{ photographer_id: string }>(
                  "SELECT photographer_id FROM bookings WHERE id = $1", [bookingId]
                );
                if (photographerProfileId) {
                  const clientFirst = bookingInfo.client_name.split(" ")[0];
                  import("@/lib/notify-photographer").then(m =>
                    m.notifyPhotographerViaTelegram(
                      photographerProfileId.photographer_id,
                      `Payment received from ${clientFirst}!\n\nYour payout: ${payoutLabel}\n\nView: https://photoportugal.com/dashboard/bookings`
                    )
                  ).catch((err) => console.error("[webhook] telegram photographer payment error:", err));
                }
              } catch (tgErr) {
                console.error("[webhook] photographer telegram error:", tgErr);
              }
            }
          } catch (emailErr) {
            console.error("[webhook] payment email error:", emailErr);
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const bookingId = paymentIntent.metadata?.booking_id;
        const giftCardId = paymentIntent.metadata?.gift_card_id;

        if (bookingId) {
          // Update by booking_id (payment intent may or may not be pre-linked)
          await queryOne(
            "UPDATE bookings SET payment_status = 'paid', stripe_payment_intent_id = $1 WHERE id = $2 RETURNING id",
            [paymentIntent.id, bookingId]
          );
          console.log(`[webhook] Payment succeeded for booking ${bookingId}`);
        }

        // Gift card purchase: create dormant recipient user, set
        // status='sent', fire the magic-link email + SMS nudge. Idempotent
        // — re-running the webhook on a 'sent' or 'claimed' card is a no-op.
        if (giftCardId) {
          try {
            const { handleGiftCardPaymentSuccess } = await import("@/lib/gift-card-fulfillment");
            await handleGiftCardPaymentSuccess(giftCardId, paymentIntent.id);
          } catch (err) {
            console.error("[webhook] gift card fulfillment error:", err);
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const bookingId = paymentIntent.metadata?.booking_id;
        const giftCardId = paymentIntent.metadata?.gift_card_id;

        if (bookingId) {
          await queryOne(
            "UPDATE bookings SET payment_status = 'failed' WHERE id = $1 RETURNING id",
            [bookingId]
          );
          console.log(`[webhook] Payment failed for booking ${bookingId}`);

          // Notify client about failed payment
          try {
            const failedBooking = await queryOne<{ client_email: string; client_name: string; photographer_name: string }>(
              `SELECT cu.email as client_email, cu.name as client_name, pu.name as photographer_name
               FROM bookings b JOIN users cu ON cu.id = b.client_id
               JOIN photographer_profiles pp ON pp.id = b.photographer_id
               JOIN users pu ON pu.id = pp.user_id
               WHERE b.id = $1`, [bookingId]
            );
            if (failedBooking) {
              sendPaymentFailedToClient(failedBooking.client_email, failedBooking.client_name, failedBooking.photographer_name)
                .catch(err => console.error("[webhook] payment failed email error:", err));
            }
          } catch (err) {
            console.error("[webhook] payment failed notification error:", err);
          }
        }

        // Gift-card purchase failed → mark as 'refunded' and alert admin.
        // The buyer's success page will show "We couldn't process your card —
        // please try again". The dormant user (if created) stays clean
        // until next attempt. Money was never captured.
        if (giftCardId) {
          await queryOne(
            "UPDATE gift_cards SET status = 'refunded' WHERE id = $1 AND status = 'purchased' RETURNING id",
            [giftCardId]
          ).catch((e) => console.error("[webhook] gift_card mark refunded:", e));
          try {
            const card = await queryOne<{ code: string; buyer_email: string; buyer_name: string; recipient_email: string; tier: string }>(
              "SELECT code, buyer_email, buyer_name, recipient_email, tier::text as tier FROM gift_cards WHERE id = $1",
              [giftCardId]
            );
            const { sendTelegram } = await import("@/lib/telegram");
            if (card) sendTelegram(
              `❌ <b>Gift card payment failed</b>\n\n<b>From:</b> ${card.buyer_name} (${card.buyer_email})\n<b>To:</b> ${card.recipient_email}\n<b>Tier:</b> ${card.tier} · <b>Code:</b> <code>${card.code}</code>`,
              "stripe"
            ).catch(() => {});
          } catch (err) {
            console.error("[webhook] gift_card payment-failed alert error:", err);
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const photographerId = subscription.metadata?.photographer_id;
        const subType = subscription.metadata?.type;
        const isCreated = event.type === "customer.subscription.created";

        if (photographerId && subType === "featured") {
          // Featured add-on subscription
          const isFeatured = subscription.status === "active";
          await queryOne(
            "UPDATE photographer_profiles SET is_featured = $1 WHERE id = $2 RETURNING id",
            [isFeatured, photographerId]
          );
          console.log(`[webhook] Featured subscription ${subscription.status} for photographer ${photographerId} → is_featured=${isFeatured}`);
          if (isCreated && isFeatured) {
            await notifyAdminSubscriptionEvent(
              photographerId,
              "⭐",
              "Featured purchased",
              `Plan: Featured (€19/mo recurring)\nStatus: ${subscription.status}`,
            );
          }
        } else if (photographerId && subType === "verified") {
          // Verified badge subscription — was previously only handled via
          // checkout.session.completed, but that branch reads metadata.type
          // off the *checkout session* (which is empty), not subscription_data.
          // So Verified purchases silently failed to flip is_verified.
          const isVerified = subscription.status === "active";
          await queryOne(
            "UPDATE photographer_profiles SET is_verified = $1 WHERE id = $2 RETURNING id",
            [isVerified, photographerId]
          );
          console.log(`[webhook] Verified subscription ${subscription.status} for photographer ${photographerId} → is_verified=${isVerified}`);
          if (isCreated && isVerified) {
            await notifyAdminSubscriptionEvent(
              photographerId,
              "✅",
              "Verified purchased",
              `Plan: Verified (€19/yr recurring)\nStatus: ${subscription.status}`,
            );
          }
        } else if (photographerId && subscription.metadata?.plan) {
          // Plan subscription
          const plan = subscription.metadata.plan;
          const newPlan = subscription.status === "active" ? plan : "free";
          // On downgrade from premium: revert custom slug to default
          if (newPlan === "free") {
            const currentProfile = await queryOne<{ slug: string; user_id: string }>(
              "SELECT slug, user_id FROM photographer_profiles WHERE id = $1", [photographerId]
            );
            if (currentProfile && !currentProfile.slug.startsWith("p-")) {
              const defaultSlug = `p-${currentProfile.user_id.replace(/-/g, "").slice(0, 10)}`;
              await queryOne(
                "INSERT INTO slug_redirects (old_slug, photographer_id) VALUES ($1, $2) ON CONFLICT (old_slug) DO NOTHING",
                [currentProfile.slug, photographerId]
              );
              await queryOne(
                "UPDATE photographer_profiles SET slug = $1 WHERE id = $2 RETURNING id",
                [defaultSlug, photographerId]
              );
            }
          }
          await queryOne(
            "UPDATE photographer_profiles SET plan = $1 WHERE id = $2 RETURNING id",
            [newPlan, photographerId]
          );
          console.log(`[webhook] Subscription ${subscription.status} for photographer ${photographerId} → ${newPlan}`);
          try {
            const info = await queryOne<{ email: string; name: string }>(
              "SELECT u.email, u.name FROM users u JOIN photographer_profiles pp ON pp.user_id = u.id WHERE pp.id = $1", [photographerId]
            );
            if (info) sendSubscriptionEmail(info.email, info.name, newPlan, newPlan === "free" ? "downgraded" : "upgraded");
          } catch {}
          if (isCreated && subscription.status === "active") {
            await notifyAdminSubscriptionEvent(
              photographerId,
              "💎",
              `Plan purchased: ${plan}`,
              `Plan: ${plan}\nStatus: ${subscription.status}`,
            );
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const photographerId = subscription.metadata?.photographer_id;
        const subType = subscription.metadata?.type;

        if (photographerId && subType === "featured") {
          // Featured add-on cancelled
          await queryOne("UPDATE photographer_profiles SET is_featured = FALSE WHERE id = $1 RETURNING id", [photographerId]);
          console.log(`[webhook] Featured subscription cancelled for photographer ${photographerId}`);
          await notifyAdminSubscriptionEvent(
            photographerId,
            "🚫",
            "Featured cancelled",
            `Plan: Featured`,
          );
        } else if (photographerId && subType === "verified") {
          // Verified badge subscription cancelled
          await queryOne("UPDATE photographer_profiles SET is_verified = FALSE WHERE id = $1 RETURNING id", [photographerId]);
          console.log(`[webhook] Verified subscription cancelled for photographer ${photographerId}`);
          await notifyAdminSubscriptionEvent(
            photographerId,
            "🚫",
            "Verified cancelled",
            `Plan: Verified`,
          );
        } else if (photographerId) {
          // Plan subscription cancelled — revert custom slug
          const cancelledProfile = await queryOne<{ slug: string; user_id: string }>(
            "SELECT slug, user_id FROM photographer_profiles WHERE id = $1", [photographerId]
          );
          if (cancelledProfile && !cancelledProfile.slug.startsWith("p-")) {
            const defaultSlug = `p-${cancelledProfile.user_id.replace(/-/g, "").slice(0, 10)}`;
            await queryOne(
              "INSERT INTO slug_redirects (old_slug, photographer_id) VALUES ($1, $2) ON CONFLICT (old_slug) DO NOTHING",
              [cancelledProfile.slug, photographerId]
            );
            await queryOne("UPDATE photographer_profiles SET slug = $1 WHERE id = $2", [defaultSlug, photographerId]);
          }
          await queryOne("UPDATE photographer_profiles SET plan = 'free' WHERE id = $1 RETURNING id", [photographerId]);
          console.log(`[webhook] Subscription cancelled for photographer ${photographerId} → free`);
          try {
            const info = await queryOne<{ email: string; name: string }>(
              "SELECT u.email, u.name FROM users u JOIN photographer_profiles pp ON pp.user_id = u.id WHERE pp.id = $1", [photographerId]
            );
            if (info) sendSubscriptionEmail(info.email, info.name, "Free", "cancelled");
          } catch {}
          await notifyAdminSubscriptionEvent(
            photographerId,
            "🚫",
            "Plan cancelled",
            `Reverted to: free`,
          );
        }
        break;
      }

      case "invoice.paid": {
        // Recurring subscription renewal — Stripe sends this on first charge
        // (billing_reason='subscription_create') and on every cycle renewal
        // (billing_reason='subscription_cycle'). We notify only on cycles —
        // first-charge already gets a "purchased" alert via customer.subscription.created.
        const invoice = event.data.object as unknown as {
          billing_reason?: string;
          subscription?: string;
          amount_paid?: number;
          currency?: string;
        };
        if (invoice.billing_reason === "subscription_cycle" && invoice.subscription) {
          try {
            const sub = await stripeClient.subscriptions.retrieve(invoice.subscription);
            const photographerId = sub.metadata?.photographer_id;
            const subType = sub.metadata?.type;
            const plan = sub.metadata?.plan;
            if (photographerId) {
              const amount = ((invoice.amount_paid || 0) / 100).toFixed(2);
              const currency = (invoice.currency || "eur").toUpperCase();
              const label = subType === "featured" ? "Featured" : subType === "verified" ? "Verified" : plan ? `Plan: ${plan}` : "Subscription";
              await notifyAdminSubscriptionEvent(
                photographerId,
                "🔄",
                `Renewal charged: ${label}`,
                `Amount: ${amount} ${currency}`,
              );
            }
          } catch (err) {
            console.error("[webhook] invoice.paid notify failed:", err);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        // Renewal payment failed — admin should know so they can chase the
        // photographer before the subscription auto-cancels (Stripe retries 3-4 times).
        const invoice = event.data.object as unknown as {
          billing_reason?: string;
          subscription?: string;
          attempt_count?: number;
          amount_due?: number;
          currency?: string;
        };
        if (invoice.subscription) {
          try {
            const sub = await stripeClient.subscriptions.retrieve(invoice.subscription);
            const photographerId = sub.metadata?.photographer_id;
            const subType = sub.metadata?.type;
            const plan = sub.metadata?.plan;
            if (photographerId) {
              const amount = ((invoice.amount_due || 0) / 100).toFixed(2);
              const currency = (invoice.currency || "eur").toUpperCase();
              const label = subType === "featured" ? "Featured" : subType === "verified" ? "Verified" : plan ? `Plan: ${plan}` : "Subscription";
              await notifyAdminSubscriptionEvent(
                photographerId,
                "⚠️",
                `Renewal FAILED: ${label}`,
                `Amount due: ${amount} ${currency}\nAttempt: ${invoice.attempt_count || 1}\nReason: ${invoice.billing_reason || "renewal"}`,
              );
            }
          } catch (err) {
            console.error("[webhook] invoice.payment_failed notify failed:", err);
          }
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object;
        if (account.charges_enabled && account.payouts_enabled) {
          await queryOne(
            "UPDATE photographer_profiles SET stripe_onboarding_complete = TRUE WHERE stripe_account_id = $1 RETURNING id",
            [account.id]
          );
          console.log(`[webhook] Stripe account ${account.id} onboarding complete`);
        }
        break;
      }
    }
  } catch (error) {
    console.error("[stripe/webhook] Error processing event:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/stripe/webhook", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  // Revalidate public pages after any subscription/payment change
  revalidatePath("/");
  revalidatePath("/photographers");

  return NextResponse.json({ received: true });
}

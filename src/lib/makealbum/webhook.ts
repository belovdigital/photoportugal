import { signPayload } from "./signing";
import { query } from "@/lib/db";

export interface MakeAlbumWebhookPayload {
  event: "album.paid" | "checkout.paid" | "payment.succeeded";
  orderId: string;
  albumId: string;
  checkoutId: string;
  paymentId: string;
  amountCents: number;
  currency: string;
  shippingAddress: {
    name: string;
    line1: string;
    line2: string;
    city: string;
    postalCode: string;
    countryCode: string;
    state: string;
    phone: string;
    email: string;
  };
}

/**
 * Fire-and-log delivery of the post-payment webhook to MakeAlbum.
 *
 * Single attempt with structured logging — does NOT throw. Stores attempt
 * count + last error on the `makealbum_orders` row so a future retry cron
 * can pick up undelivered rows. We don't retry inline because Stripe will
 * itself retry the parent webhook event if we 500, which would double-
 * fire on MakeAlbum's side; the order row is the source of truth for
 * delivery status.
 */
export async function deliverMakeAlbumWebhook(
  webhookUrl: string,
  payload: MakeAlbumWebhookPayload,
  ppCheckoutId: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const secret = process.env.PHOTO_PORTUGAL_WEBHOOK_SECRET || process.env.PHOTO_PORTUGAL_SHARED_SECRET;
  if (!secret) {
    return { ok: false, error: "PHOTO_PORTUGAL_WEBHOOK_SECRET not configured" };
  }

  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(secret, timestamp, rawBody);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PhotoPortugal-Timestamp": String(timestamp),
        "X-PhotoPortugal-Signature": signature,
      },
      body: rawBody,
      // 10s ceiling — MakeAlbum should ack fast; anything slower is a problem
      // we want surfaced rather than swallowed by a hung fetch.
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      await query(
        `UPDATE makealbum_orders
           SET webhook_delivered_at = NOW(),
               webhook_attempts     = webhook_attempts + 1,
               webhook_last_error   = NULL
         WHERE id = $1`,
        [ppCheckoutId],
      ).catch((e) => console.error("[makealbum] failed to mark webhook delivered:", e));
      return { ok: true, status: res.status };
    }

    const detail = await res.text().catch(() => "");
    const errMsg = `webhook ${res.status}: ${detail.slice(0, 200)}`;
    await query(
      `UPDATE makealbum_orders
         SET webhook_attempts   = webhook_attempts + 1,
             webhook_last_error = $2
       WHERE id = $1`,
      [ppCheckoutId, errMsg],
    ).catch((e) => console.error("[makealbum] failed to record webhook error:", e));
    return { ok: false, status: res.status, error: errMsg };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await query(
      `UPDATE makealbum_orders
         SET webhook_attempts   = webhook_attempts + 1,
             webhook_last_error = $2
       WHERE id = $1`,
      [ppCheckoutId, errMsg],
    ).catch((e) => console.error("[makealbum] failed to record webhook error:", e));
    return { ok: false, error: errMsg };
  }
}

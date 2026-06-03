import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { voidUncapturedPaymentIntent } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// GET /api/cron/auto-refund-blind?secret=...
//
// Hourly: scan blind bookings (status='unmatched') whose auto_refund_at
// has passed. For each, void the Stripe auth-hold and mark the booking
// 'cancelled', then email the client + alert admins. Also enforces the
// Stripe ~7-day capture window: any blind booking older than 6 days
// gets voided regardless of auto_refund_at as a safety net (otherwise
// Stripe silently expires the PI and we'd think it was still authed).
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { voided: 0, errors: [] as string[] };

  try {
    // Blind bookings are 'confirmed' status with photographer_id=NULL
    // (refactor 2026-06-03). Filter for auth-hold expiry OR 6-day
    // safety net (Stripe auto-voids capture window).
    const candidates = await query<{
      id: string;
      stripe_payment_intent_id: string | null;
      client_id: string;
      total_price: number | null;
      auto_refund_at: string | null;
      created_at: string;
    }>(
      `SELECT id, stripe_payment_intent_id, client_id, total_price,
              auto_refund_at::text, created_at::text
         FROM bookings
        WHERE status = 'confirmed'
          AND photographer_id IS NULL
          AND blind_booking = TRUE
          AND (
            (auto_refund_at IS NOT NULL AND auto_refund_at <= NOW())
            OR created_at <= NOW() - INTERVAL '6 days'
          )
        ORDER BY auto_refund_at NULLS LAST, created_at
        LIMIT 25`
    );

    for (const b of candidates) {
      try {
        let voidedOrAlreadyVoid = true;
        if (b.stripe_payment_intent_id) {
          try {
            await voidUncapturedPaymentIntent(b.stripe_payment_intent_id);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            // Two distinct failure modes:
            //   (a) already captured — money is gone to platform, MUST
            //       NOT mark booking refunded. Skip this booking entirely
            //       and alert; admin needs to refund manually.
            //   (b) already void/expired/cancelled — safe to proceed
            //       with marking the booking cancelled.
            const alreadyCaptured = /already\s*captur|already_captured|requires_capture/i.test(msg);
            if (alreadyCaptured) {
              console.error(`[cron/auto-refund-blind] PI ${b.stripe_payment_intent_id} already CAPTURED — skipping (admin must refund manually):`, msg);
              import("@/lib/telegram").then(({ sendTelegram }) =>
                sendTelegram(
                  `<b>⚠️ Auto-refund cron skipped — PI already captured</b>\nBooking: <code>${b.id.slice(0, 8)}</code>\nPI: <code>${b.stripe_payment_intent_id}</code>\nReason: ${msg}\nAction: refund manually in Stripe Dashboard if intended.`,
                  "bookings"
                )
              ).catch(() => {});
              voidedOrAlreadyVoid = false;
            } else {
              console.warn(`[cron/auto-refund-blind] void PI ${b.stripe_payment_intent_id} no-op (${msg})`);
            }
          }
        }

        // Skip the booking-cancellation UPDATE only if PI was captured
        // out from under us. In all other cases (no PI, void succeeded,
        // already-void) it's safe to mark cancelled+refunded. Also gate
        // on status='unmatched' so a racing admin-assign doesn't get
        // stomped (audit finding #5).
        if (!voidedOrAlreadyVoid) continue;

        await queryOne(
          `UPDATE bookings
              SET status = 'cancelled',
                  cancelled_by = 'system',
                  cancelled_reason = 'Auto-refund: no photographer assigned within deadline',
                  payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END,
                  auto_refund_at = NULL
            WHERE id = $1
              AND status = 'confirmed'
              AND photographer_id IS NULL
              AND blind_booking = TRUE
            RETURNING id`,
          [b.id]
        );

        // Email the client.
        const ctx = await queryOne<{ email: string; name: string; location_slug: string | null; shoot_date: string | null }>(
          `SELECT u.email, u.name, bk.location_slug, bk.shoot_date::text
             FROM bookings bk JOIN users u ON u.id = bk.client_id
            WHERE bk.id = $1`,
          [b.id]
        );
        if (ctx?.email) {
          import("@/lib/email").then(({ sendEmail }) => {
            const BASE = process.env.AUTH_URL || "https://photoportugal.com";
            return sendEmail(
              ctx.email,
              "Your booking was refunded — let's find another way",
              `<div style="font-family: sans-serif; max-width: 540px; margin: 0 auto;">
                <h2 style="color:#C94536;">We couldn't lock in a photographer in time</h2>
                <p>Hi ${(ctx.name.split(" ")[0] || ctx.name).replace(/[<>]/g, "")},</p>
                <p>Our team couldn't confirm a photographer for your ${ctx.location_slug || "photoshoot"} session ${ctx.shoot_date ? `on ${ctx.shoot_date}` : ""} within the 24-hour window. Your card was authorised but never charged — the hold has been released and you'll see it drop off within a few days.</p>
                <p>If you'd still like to book, our directory is right here — many photographers are available for the same date:</p>
                <p><a href="${BASE}/find-photographer" style="display:inline-block;background:#C94536;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Browse photographers</a></p>
                <p style="color:#999;font-size:12px;">Photo Portugal — photoportugal.com</p>
              </div>`
            );
          }).catch((err) => console.error("[cron/auto-refund-blind] email error:", err));
        }

        // Alert admins.
        import("@/lib/telegram").then(({ sendTelegram }) =>
          sendTelegram(
            `<b>⚠️ Blind booking auto-refunded</b>\nBooking: <code>${b.id.slice(0, 8)}</code>\nAmount: €${b.total_price ? Math.round(Number(b.total_price)) : "?"}\nReason: no photographer assigned within 24h.`,
            "bookings"
          )
        ).catch((err) => console.error("[cron/auto-refund-blind] telegram error:", err));

        results.voided++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`booking ${b.id}: ${msg}`);
      }
    }
  } catch (err) {
    results.errors.push(`scan: ${err instanceof Error ? err.message : String(err)}`);
  }

  return NextResponse.json(results);
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/api/admin/login/route";
import { queryOne } from "@/lib/db";
import { deliverMakeAlbumWebhook } from "@/lib/makealbum/webhook";

export const runtime = "nodejs";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? !!verifyToken(token) : false;
}

// Re-fire the post-payment webhook to MakeAlbum. Used when the initial
// delivery from the Stripe webhook handler failed (network blip,
// MakeAlbum was down, signature mismatch in their verifier, etc.). Only
// fires for rows already marked `paid` — pending orders have nothing
// useful to send yet.
export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { checkout_id } = await req.json();
  if (!checkout_id) return NextResponse.json({ error: "checkout_id required" }, { status: 400 });

  const row = await queryOne<{
    id: string;
    makealbum_order_id: string;
    makealbum_album_id: string;
    amount_cents: number;
    currency: string;
    webhook_url: string;
    status: string;
    stripe_payment_intent_id: string | null;
    shipping_address: {
      name?: string; line1?: string; line2?: string; city?: string;
      postalCode?: string; countryCode?: string; state?: string; phone?: string; email?: string;
    } | null;
  }>(
    `SELECT id, makealbum_order_id, makealbum_album_id, amount_cents, currency,
            webhook_url, status, stripe_payment_intent_id, shipping_address
       FROM makealbum_orders
      WHERE id = $1`,
    [checkout_id],
  );

  if (!row) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (row.status !== "paid") {
    return NextResponse.json({ error: `Order is ${row.status} — only paid orders can be redrived` }, { status: 409 });
  }

  const ship = row.shipping_address || {};
  const result = await deliverMakeAlbumWebhook(
    row.webhook_url,
    {
      event: "album.paid",
      orderId: row.makealbum_order_id,
      albumId: row.makealbum_album_id,
      checkoutId: row.id,
      paymentId: row.stripe_payment_intent_id || "",
      amountCents: row.amount_cents,
      currency: row.currency,
      shippingAddress: {
        name: ship.name || "",
        line1: ship.line1 || "",
        line2: ship.line2 || "",
        city: ship.city || "",
        postalCode: ship.postalCode || "",
        countryCode: ship.countryCode || "",
        state: ship.state || "",
        phone: ship.phone || "",
        email: ship.email || "",
      },
    },
    row.id,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Delivery failed", status: result.status }, { status: 502 });
  }
  return NextResponse.json({ ok: true, status: result.status });
}

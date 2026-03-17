import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const VERIFIED_PRICE = 1900; // €19.00

async function getVerifiedPriceId(): Promise<string> {
  if (process.env.STRIPE_VERIFIED_PRICE_ID) return process.env.STRIPE_VERIFIED_PRICE_ID;

  // Search for existing product
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = await (stripe.products.list as any)({ limit: 100, active: true });
  const verifiedProduct = products.data.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => p.metadata?.type === "verified" && p.active
  );

  if (verifiedProduct) {
    const prices = await stripe.prices.list({ product: verifiedProduct.id, active: true, limit: 1 });
    if (prices.data.length > 0) return prices.data[0].id;
  }

  // Create product + price (one-time, not recurring)
  const product = await stripe.products.create({
    name: "Photo Portugal — Verified Badge",
    description: "Identity-verified badge with phone number confirmation",
    metadata: { type: "verified" },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: VERIFIED_PRICE,
    currency: "eur",
    // No recurring — one-time payment
  });

  console.log(`[verified] Created Stripe product: ${product.id}, price: ${price.id} — add STRIPE_VERIFIED_PRICE_ID=${price.id} to env`);
  return price.id;
}

// Create checkout session for verified badge (one-time payment)
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;

  try {
    const profile = await queryOne<{ id: string; is_verified: boolean; phone_verified: boolean }>(
      "SELECT id, is_verified, phone_verified FROM photographer_profiles WHERE user_id = $1", [userId]
    );
    if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 400 });
    if (profile.is_verified) return NextResponse.json({ error: "Already verified" }, { status: 400 });
    if (!profile.phone_verified) return NextResponse.json({ error: "Phone must be verified first" }, { status: 400 });

    const user = await queryOne<{ email: string; stripe_customer_id: string | null }>(
      "SELECT email, stripe_customer_id FROM users WHERE id = $1", [userId]
    );
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Get or create Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: userId!, photographer_id: profile.id },
      });
      customerId = customer.id;
      await queryOne("UPDATE users SET stripe_customer_id = $1 WHERE id = $2 RETURNING id", [customerId, userId]);
    }

    const priceId = await getVerifiedPriceId();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkoutSession = await (stripe.checkout.sessions.create as any)({
      customer: customerId,
      mode: "payment",
      locale: "auto",
      adaptive_pricing: { enabled: true },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.AUTH_URL}/dashboard/subscription?verified=success`,
      cancel_url: `${process.env.AUTH_URL}/dashboard/subscription?verified=canceled`,
      metadata: {
        photographer_id: profile.id,
        type: "verified",
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[stripe/verified] error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

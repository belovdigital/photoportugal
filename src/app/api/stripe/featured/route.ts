import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";

const FEATURED_PRICE = 1900; // €19.00

async function getFeaturedPriceId(): Promise<string> {
  // Use env var if set
  if (process.env.STRIPE_FEATURED_PRICE_ID) return process.env.STRIPE_FEATURED_PRICE_ID;

  // Search for existing product with metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeClient = requireStripe();
  const products = await (stripeClient.products.list as any)({ limit: 100, active: true });
  const featuredProduct = products.data.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => p.metadata?.type === "featured" && p.active
  );

  if (featuredProduct) {
    const prices = await stripeClient.prices.list({ product: featuredProduct.id, active: true, limit: 1 });
    if (prices.data.length > 0) return prices.data[0].id;
  }

  // Create product + price (one-time)
  const product = await stripeClient.products.create({
    name: "Photo Portugal — Featured Placement",
    description: "Homepage featured section and priority search ranking with Featured badge",
    metadata: { type: "featured" },
  });
  const price = await stripeClient.prices.create({
    product: product.id,
    unit_amount: FEATURED_PRICE,
    currency: "eur",
    recurring: { interval: "month" },
  });

  console.log(`[featured] Created Stripe product: ${product.id}, price: ${price.id} — add STRIPE_FEATURED_PRICE_ID=${price.id} to env`);
  return price.id;
}

// Create checkout session for featured subscription
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;

  try {
    const profile = await queryOne<{ id: string; is_featured: boolean }>(
      "SELECT id, is_featured FROM photographer_profiles WHERE user_id = $1", [userId]
    );
    if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 400 });
    if (profile.is_featured) return NextResponse.json({ error: "Already featured" }, { status: 400 });

    const user = await queryOne<{ email: string; stripe_customer_id: string | null }>(
      "SELECT email, stripe_customer_id FROM users WHERE id = $1", [userId]
    );
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Get or create Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await requireStripe().customers.create({
        email: user.email,
        metadata: { user_id: userId!, photographer_id: profile.id },
      });
      customerId = customer.id;
      await queryOne("UPDATE users SET stripe_customer_id = $1 WHERE id = $2 RETURNING id", [customerId, userId]);
    }

    const priceId = await getFeaturedPriceId();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkoutSession = await (requireStripe().checkout.sessions.create as any)({
      customer: customerId,
      mode: "subscription",
      locale: "auto",
      adaptive_pricing: { enabled: true },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.AUTH_URL}/dashboard/subscriptions?featured=success`,
      cancel_url: `${process.env.AUTH_URL}/dashboard/subscriptions?featured=canceled`,
      subscription_data: {
        metadata: { photographer_id: profile.id, type: "featured" },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[stripe/featured] error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

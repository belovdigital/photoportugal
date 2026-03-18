import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const PRICE_IDS: Record<string, string> = {
  pro: process.env.STRIPE_PRO_PRICE_ID || "price_1TC1VTGU0seq3XOV7ztETK3Z",
  premium: process.env.STRIPE_PREMIUM_PRICE_ID || "price_1TC1VUGU0seq3XOVrUaqC0U4",
};

// Create or manage subscription
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  const { plan, action } = await req.json();

  try {
    const profile = await queryOne<{ id: string; stripe_account_id: string | null }>(
      "SELECT pp.id, pp.stripe_account_id FROM photographer_profiles pp WHERE pp.user_id = $1", [userId]
    );
    if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 400 });

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

    if (action === "portal") {
      // Billing portal for managing payment methods, invoices, cancellation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const portalSession = await (stripe.billingPortal.sessions.create as any)({
        customer: customerId,
        return_url: `${process.env.AUTH_URL}/dashboard/subscriptions`,
      });
      return NextResponse.json({ url: portalSession.url });
    }

    if (action === "subscribe" && plan && PRICE_IDS[plan]) {
      // Create checkout session for subscription
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const checkoutSession = await (stripe.checkout.sessions.create as any)({
        customer: customerId,
        mode: "subscription",
        locale: "auto",
        adaptive_pricing: { enabled: true },
        line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
        success_url: `${process.env.AUTH_URL}/dashboard/subscriptions?success=true`,
        cancel_url: `${process.env.AUTH_URL}/dashboard/subscriptions?canceled=true`,
        subscription_data: { metadata: { photographer_id: profile.id, plan } },
      });
      return NextResponse.json({ url: checkoutSession.url });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[stripe/subscription] error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";

const PRICE_IDS: Record<string, string> = {
  pro: process.env.STRIPE_PRO_PRICE_ID || "price_1TC1VTGU0seq3XOV7ztETK3Z",
  premium: process.env.STRIPE_PREMIUM_PRICE_ID || "price_1TC1VUGU0seq3XOVrUaqC0U4",
};

// Create or manage subscription
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  const { plan, action, locale } = await req.json();
  const lp = locale && locale !== "en" && ["pt","de","es","fr"].includes(locale) ? `/${locale}` : "";

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
      const customer = await requireStripe().customers.create({
        email: user.email,
        metadata: { user_id: userId!, photographer_id: profile.id },
      });
      customerId = customer.id;
      await queryOne("UPDATE users SET stripe_customer_id = $1 WHERE id = $2 RETURNING id", [customerId, userId]);
    }

    if (action === "portal") {
      // Billing portal for managing payment methods, invoices, cancellation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const portalSession = await (requireStripe().billingPortal.sessions.create as any)({
        customer: customerId,
        return_url: `${process.env.AUTH_URL}${lp}/dashboard/subscriptions`,
      });
      return NextResponse.json({ url: portalSession.url });
    }

    if (action === "subscribe" && plan && PRICE_IDS[plan]) {
      // Cancel any existing plan subscription before creating a new one
      const existingProfile = await queryOne<{ stripe_subscription_id: string | null }>(
        "SELECT stripe_subscription_id FROM photographer_profiles WHERE id = $1", [profile.id]
      );
      if (existingProfile?.stripe_subscription_id) {
        try {
          await requireStripe().subscriptions.cancel(existingProfile.stripe_subscription_id);
          await queryOne(
            "UPDATE photographer_profiles SET stripe_subscription_id = NULL WHERE id = $1 RETURNING id",
            [profile.id]
          );
          console.log(`[stripe/subscription] Cancelled existing subscription ${existingProfile.stripe_subscription_id} for photographer ${profile.id}`);
        } catch (cancelErr) {
          // Subscription may already be cancelled/invalid — log and continue
          console.warn(`[stripe/subscription] Failed to cancel existing subscription ${existingProfile.stripe_subscription_id}:`, cancelErr);
        }
      }

      // Create checkout session for subscription
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const checkoutSession = await (requireStripe().checkout.sessions.create as any)({
        customer: customerId,
        mode: "subscription",
        locale: ["pt","de","es","fr"].includes(locale) ? locale : "auto",
        adaptive_pricing: { enabled: true },
        allow_promotion_codes: true,
        line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
        success_url: `${process.env.AUTH_URL}${lp}/dashboard/subscriptions?success=true`,
        cancel_url: `${process.env.AUTH_URL}${lp}/dashboard/subscriptions?canceled=true`,
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

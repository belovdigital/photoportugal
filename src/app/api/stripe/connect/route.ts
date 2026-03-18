import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// Create Stripe Connect Express account for photographer
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;

  try {
    const profile = await queryOne<{ id: string; stripe_account_id: string | null }>(
      "SELECT id, stripe_account_id FROM photographer_profiles WHERE user_id = $1",
      [userId]
    );

    if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 400 });

    let accountId = profile.stripe_account_id;

    // Create Stripe Express account if doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "PT",
        email: session.user.email!,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
      });
      accountId = account.id;

      await queryOne(
        "UPDATE photographer_profiles SET stripe_account_id = $1 WHERE id = $2 RETURNING id",
        [accountId, profile.id]
      );
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.AUTH_URL}/dashboard/subscriptions?stripe=refresh`,
      return_url: `${process.env.AUTH_URL}/dashboard/subscriptions?stripe=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("[stripe/connect] error:", error);
    return NextResponse.json({ error: "Failed to create Stripe account" }, { status: 500 });
  }
}

// Check Stripe Connect status
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;

  try {
    const profile = await queryOne<{ stripe_account_id: string | null; stripe_onboarding_complete: boolean }>(
      "SELECT stripe_account_id, stripe_onboarding_complete FROM photographer_profiles WHERE user_id = $1",
      [userId]
    );

    if (!profile || !profile.stripe_account_id) {
      return NextResponse.json({ connected: false, onboarded: false });
    }

    // Check if onboarding is complete
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    const onboarded = account.charges_enabled && account.payouts_enabled;

    if (onboarded && !profile.stripe_onboarding_complete) {
      await queryOne(
        "UPDATE photographer_profiles SET stripe_onboarding_complete = TRUE WHERE user_id = $1 RETURNING id",
        [userId]
      );
    }

    return NextResponse.json({
      connected: true,
      onboarded,
      account_id: profile.stripe_account_id,
    });
  } catch (error) {
    console.error("[stripe/connect] GET error:", error);
    return NextResponse.json({ connected: false, onboarded: false });
  }
}

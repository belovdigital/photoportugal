import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";

// Create Stripe Connect Express account for photographer
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let locale = "en";
  let country = "PT";
  try { const body = await req.json(); locale = body.locale || "en"; country = body.country || "PT"; } catch {}

  const userId = (session.user as { id?: string }).id;

  let stripeClient;
  try {
    stripeClient = requireStripe();
  } catch {
    console.error("[stripe/connect] Stripe not configured");
    return NextResponse.json({ error: "Stripe is not configured on the server" }, { status: 500 });
  }

  try {
    const profile = await queryOne<{ id: string; stripe_account_id: string | null }>(
      "SELECT id, stripe_account_id FROM photographer_profiles WHERE user_id = $1",
      [userId]
    );

    if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 400 });

    let accountId = profile.stripe_account_id;

    // Create Stripe Express account if doesn't exist
    if (!accountId) {
      const account = await stripeClient.accounts.create({
        type: "express",
        country,
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
    const accountLink = await stripeClient.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.AUTH_URL}${locale === "pt" ? "/pt" : ""}/dashboard/subscriptions?stripe=refresh`,
      return_url: `${process.env.AUTH_URL}${locale === "pt" ? "/pt" : ""}/dashboard/subscriptions?stripe=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("[stripe/connect] error:", error);
    const message = error instanceof Error ? error.message : "Failed to create Stripe account";
    return NextResponse.json({ error: message }, { status: 500 });
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

    // Check if onboarding is complete via Stripe API
    const stripeClient = requireStripe();
    const account = await stripeClient.accounts.retrieve(profile.stripe_account_id);
    const onboarded = account.charges_enabled && account.payouts_enabled;

    if (onboarded && !profile.stripe_onboarding_complete) {
      const updated = await queryOne<{ id: string }>(
        "UPDATE photographer_profiles SET stripe_onboarding_complete = TRUE WHERE user_id = $1 RETURNING id",
        [userId]
      );
      // Stripe was the last checklist step — check if ready for review now
      if (updated) {
        import("@/lib/checklist-notify").then(m =>
          m.checkAndNotifyChecklistComplete(updated.id)
        ).catch(e => console.error("[stripe/connect] checklist notify error:", e));
      }
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

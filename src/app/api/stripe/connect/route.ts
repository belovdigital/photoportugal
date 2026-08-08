import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";
import { country, localePathPrefix } from "@/lib/country";

// Create Stripe Connect Express account for photographer
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The connected account's country decides which ID documents and which bank
  // account Stripe asks the photographer for. It is NOT the platform's country:
  // a Portuguese-registered platform onboards Spanish photographers into ES
  // accounts with Spanish IBANs, which is the whole reason Connect works here.
  //
  // This defaulted to the literal "PT" and no caller ever sent a value, so on
  // the Spanish site every photographer would have been sent to Stripe asking
  // for a Portuguese IBAN. Defaults to the market now; an explicit body value
  // still wins, for a photographer who is resident elsewhere.
  const marketCountry = country.code.toUpperCase();
  let locale = "en";
  let accountCountry = marketCountry;
  try {
    const body = await req.json();
    locale = body.locale || "en";
    accountCountry = body.country || marketCountry;
  } catch {}

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
        country: accountCountry,
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
      refresh_url: `${process.env.AUTH_URL}${localePathPrefix(locale)}/dashboard/subscriptions?stripe=refresh`,
      return_url: `${process.env.AUTH_URL}${localePathPrefix(locale)}/dashboard/subscriptions?stripe=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("[stripe/connect] error:", error);
    const message = error instanceof Error ? error.message : "Failed to create Stripe account";
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/stripe/connect", method: req.method, statusCode: 500 }); } catch {}
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
    } else if (!onboarded && profile.stripe_onboarding_complete) {
      // Stripe restricted an account we still had marked as complete —
      // clear the flag so the checklist and admin board stop showing green.
      await queryOne(
        "UPDATE photographer_profiles SET stripe_onboarding_complete = FALSE WHERE user_id = $1 RETURNING id",
        [userId]
      );
    }

    // Outstanding requirements are reported even when the account is still
    // fully usable: Stripe sets `current_deadline` weeks before it disables
    // anything, and that window is the only chance the photographer has to
    // fix it without losing payouts.
    const req = account.requirements;
    const future = account.future_requirements;
    const deadline = req?.current_deadline ?? future?.current_deadline ?? null;
    const dueNow = req?.currently_due?.length ? req.currently_due : (future?.currently_due ?? []);
    const pastDue = req?.past_due ?? [];

    return NextResponse.json({
      connected: true,
      onboarded,
      account_id: profile.stripe_account_id,
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      requirements: {
        disabled_reason: req?.disabled_reason ?? null,
        deadline: deadline ? new Date(deadline * 1000).toISOString() : null,
        currently_due: dueNow,
        past_due: pastDue,
        pending_verification: req?.pending_verification ?? [],
      },
    });
  } catch (error) {
    console.error("[stripe/connect] GET error:", error);
    return NextResponse.json({ connected: false, onboarded: false });
  }
}

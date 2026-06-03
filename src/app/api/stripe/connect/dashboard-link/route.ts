import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Returns a one-time login URL into the photographer's Stripe Express
// dashboard so they can update tax ID (NIF), bank details, business info.
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;

  const profile = await queryOne<{ stripe_account_id: string | null }>(
    "SELECT stripe_account_id FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );
  if (!profile?.stripe_account_id) {
    return NextResponse.json({ error: "Stripe account not connected" }, { status: 400 });
  }

  const stripeClient = requireStripe();
  const link = await stripeClient.accounts.createLoginLink(profile.stripe_account_id);
  return NextResponse.json({ url: link.url });
}

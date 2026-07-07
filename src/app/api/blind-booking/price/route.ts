import { NextRequest, NextResponse } from "next/server";
import { priceForSlug, blindServiceFeeFromTotal, blindBaseFromTotal, BLIND_COMPARE_AT_EUR } from "@/lib/blind-booking/pricing";
import { largeGroupMultiplier, LARGE_GROUP_THRESHOLD } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// GET /api/blind-booking/price?region=algarve&occasion=solo&duration=60&party_size=2
//
// Public, used by QuickBookingModal to render a live total as the user
// changes form fields. Since the 2026-07 summer super-offer,
// region_pricing.price_eur IS the client-inclusive total (€279/465/649);
// the photographer base is derived (total − 15% cut). We also return the
// pre-offer compare-at total + savings so the UI can render the deal.
// Returns 400 if the (region, occasion, duration) combination isn't priced.
export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region") || "";
  const occasion = req.nextUrl.searchParams.get("occasion") || "";
  const duration = parseInt(req.nextUrl.searchParams.get("duration") || "60", 10);
  const partySize = parseInt(req.nextUrl.searchParams.get("party_size") || "1", 10);

  if (!region || !occasion) {
    return NextResponse.json({ error: "region and occasion required" }, { status: 400 });
  }
  if (![60, 120, 180].includes(duration)) {
    return NextResponse.json({ error: "duration must be 60, 120, or 180" }, { status: 400 });
  }
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > 30) {
    return NextResponse.json({ error: "party_size must be 1-30" }, { status: 400 });
  }

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous";
  if (!checkRateLimit(`blind-price:ip:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many price queries" }, { status: 429 });
  }

  const priced = await priceForSlug(region, occasion, duration);
  if (!priced) {
    return NextResponse.json({ error: "No pricing available" }, { status: 404 });
  }

  // Apply 9+ large-group surcharge (matches non-blind packages flow),
  // then derive the internal split FROM the inclusive total: the client
  // pays exactly `total_eur`; our 15% cut and the photographer base are
  // carved out of it (base = total − fee).
  const groupMultiplier = largeGroupMultiplier(partySize);
  const regionalTotalEur = Number(priced.price_eur);
  const totalEur = Math.round(regionalTotalEur * groupMultiplier);
  const serviceFeeEur = blindServiceFeeFromTotal(totalEur);
  const baseEur = blindBaseFromTotal(totalEur);
  const largeGroupApplied = partySize >= LARGE_GROUP_THRESHOLD;
  // Pre-offer price for the strike-through ("was €344"), scaled by the
  // same group multiplier so large groups see a consistent comparison.
  const compareAtEur = Math.round((BLIND_COMPARE_AT_EUR[priced.duration_minutes] || 0) * groupMultiplier);
  const savingsEur = compareAtEur > totalEur ? Math.round(compareAtEur - totalEur) : 0;

  return NextResponse.json({
    region: priced.region,
    occasion: priced.occasion,
    duration_minutes: priced.duration_minutes,
    party_size: partySize,
    regional_base_eur: regionalTotalEur,
    base_eur: baseEur,
    service_fee_eur: serviceFeeEur,
    total_eur: totalEur,
    compare_at_eur: compareAtEur,
    savings_eur: savingsEur,
    savings_pct: compareAtEur > 0 ? Math.round((savingsEur / compareAtEur) * 100) : 0,
    large_group_applied: largeGroupApplied,
    large_group_surcharge_eur: largeGroupApplied ? totalEur - regionalTotalEur : 0,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { priceForSlug } from "@/lib/blind-booking/pricing";
import { SERVICE_FEE_RATE } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// GET /api/blind-booking/price?region=algarve&occasion=solo&duration=60
//
// Public, used by QuickBookingModal to render a live total as the user
// changes form fields. Returns the BASE photographer rate, the service
// fee, and the all-in total. Returns 400 if the (region, occasion,
// duration) combination isn't priced.
export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region") || "";
  const occasion = req.nextUrl.searchParams.get("occasion") || "";
  const duration = parseInt(req.nextUrl.searchParams.get("duration") || "60", 10);

  if (!region || !occasion) {
    return NextResponse.json({ error: "region and occasion required" }, { status: 400 });
  }
  if (![60, 120, 180].includes(duration)) {
    return NextResponse.json({ error: "duration must be 60, 120, or 180" }, { status: 400 });
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

  const baseEur = priced.price_eur;
  const serviceFeeEur = Math.round(baseEur * SERVICE_FEE_RATE);
  const totalEur = Math.round(baseEur * (1 + SERVICE_FEE_RATE));

  return NextResponse.json({
    region: priced.region,
    occasion: priced.occasion,
    duration_minutes: priced.duration_minutes,
    base_eur: baseEur,
    service_fee_eur: serviceFeeEur,
    total_eur: totalEur,
  });
}

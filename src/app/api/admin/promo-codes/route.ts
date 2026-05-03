import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";
import { verifyToken } from "@/app/api/admin/login/route";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;

  const data = verifyToken(token);
  if (!data) return false;

  const user = await queryOne<{ role: string }>(
    "SELECT role FROM users WHERE email = $1",
    [data.email]
  );
  return user?.role === "admin";
}

export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stripeClient = requireStripe();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promoCodes = await (stripeClient.promotionCodes.list as any)({
      limit: 50,
      expand: ["data.promotion.coupon"],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = promoCodes.data.map((pc: any) => {
      const coupon = pc.promotion?.coupon;
      return {
        id: pc.id,
        code: pc.code,
        coupon_name: coupon?.name || "",
        percent_off: coupon?.percent_off || null,
        amount_off: coupon?.amount_off ? coupon.amount_off / 100 : null,
        currency: coupon?.currency || null,
        duration: coupon?.duration || "",
        duration_in_months: coupon?.duration_in_months || null,
        times_redeemed: pc.times_redeemed || 0,
        max_redemptions: pc.max_redemptions || null,
        active: pc.active,
        expires_at: pc.expires_at || null,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[admin/promo-codes] GET error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/promo-codes", method: "GET", statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to fetch promo codes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { code, percent_off, amount_off, currency, duration, duration_in_months, max_redemptions, expires_at } = body;

    if (!code || !duration) {
      return NextResponse.json({ error: "Code and duration are required" }, { status: 400 });
    }

    if (!percent_off && !amount_off) {
      return NextResponse.json({ error: "Either percent_off or amount_off is required" }, { status: 400 });
    }

    const stripeClient = requireStripe();

    // Build coupon params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const couponParams: any = {
      duration,
      name: `Promo: ${code.toUpperCase()}`,
    };

    if (percent_off) {
      couponParams.percent_off = percent_off;
    } else if (amount_off) {
      couponParams.amount_off = Math.round(amount_off * 100); // Convert EUR to cents
      couponParams.currency = currency || "eur";
    }

    if (duration === "repeating" && duration_in_months) {
      couponParams.duration_in_months = duration_in_months;
    }

    const coupon = await stripeClient.coupons.create(couponParams);

    // Build promotion code params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promoParams: any = {
      promotion: { type: "coupon", coupon: coupon.id },
      code: code.toUpperCase(),
    };

    if (max_redemptions) {
      promoParams.max_redemptions = max_redemptions;
    }

    if (expires_at) {
      promoParams.expires_at = Math.floor(new Date(expires_at).getTime() / 1000);
    }

    const promoCode = await stripeClient.promotionCodes.create(promoParams);

    return NextResponse.json({
      id: promoCode.id,
      code: promoCode.code,
      coupon_id: coupon.id,
    });
  } catch (error) {
    console.error("[admin/promo-codes] POST error:", error);
    const message = error instanceof Error ? error.message : "Failed to create promo code";
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/promo-codes", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Promotion code ID is required" }, { status: 400 });
    }

    const stripeClient = requireStripe();
    await stripeClient.promotionCodes.update(id, { active: false });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/promo-codes] DELETE error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/promo-codes", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to deactivate promo code" }, { status: 500 });
  }
}

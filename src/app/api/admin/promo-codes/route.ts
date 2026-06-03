import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne, query } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";
import { verifyToken } from "@/app/api/admin/login/route";

async function verifyAdmin(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;

  const data = verifyToken(token);
  if (!data) return null;

  const user = await queryOne<{ role: string }>(
    "SELECT role FROM users WHERE email = $1",
    [data.email]
  );
  if (user?.role !== "admin") return null;
  return { email: data.email };
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stripeClient = requireStripe();
    // Acacia API: coupon is flat on the promotion code (`pc.coupon`),
    // not nested under `promotion`. The clover form `data.promotion.coupon`
    // expands to nothing on acacia, which is why the admin Discount
    // column rendered "—" for every row even though the Stripe data
    // had a real percent_off.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promoCodes = await (stripeClient.promotionCodes.list as any)({
      limit: 50,
      expand: ["data.coupon"],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const codeStrings: string[] = promoCodes.data.map((pc: any) => pc.code);

    // Look up: review-issued codes (10% / 15%) + local meta (notes,
    // source, created_by_email). Both are best-effort.
    const [reviewRows, metaRows] = await Promise.all([
      codeStrings.length > 0
        ? query<{ promo_code: string; video_url: string | null }>(
            `SELECT promo_code, video_url FROM reviews WHERE promo_code = ANY($1)`,
            [codeStrings]
          ).catch(() => [])
        : Promise.resolve([] as Array<{ promo_code: string; video_url: string | null }>),
      codeStrings.length > 0
        ? query<{ code: string; notes: string | null; created_by_email: string | null; source: string }>(
            `SELECT code, notes, created_by_email, source FROM promo_codes_meta WHERE code = ANY($1)`,
            [codeStrings]
          ).catch(() => [])
        : Promise.resolve([] as Array<{ code: string; notes: string | null; created_by_email: string | null; source: string }>),
    ]);
    const reviewByCode = new Map<string, { video: boolean }>();
    for (const r of reviewRows) reviewByCode.set(r.promo_code, { video: !!r.video_url });
    const metaByCode = new Map<string, { notes: string | null; created_by_email: string | null; source: string }>();
    for (const m of metaRows) metaByCode.set(m.code, { notes: m.notes, created_by_email: m.created_by_email, source: m.source });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = promoCodes.data.map((pc: any) => {
      const coupon = pc.coupon;
      const review = reviewByCode.get(pc.code);
      const meta = metaByCode.get(pc.code);
      // Source priority: reviews table wins (most specific) → meta
      // table → fall back to "manual_stripe" for codes that exist only
      // in Stripe (no local record).
      let source: "video_review" | "regular_review" | "admin_panel" | "manual_stripe";
      if (review) {
        source = review.video ? "video_review" : "regular_review";
      } else if (meta) {
        source = meta.source as "admin_panel";
      } else {
        source = "manual_stripe";
      }
      return {
        id: pc.id,
        code: pc.code,
        coupon_id: coupon?.id || null,
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
        source,
        notes: meta?.notes || null,
        created_by_email: meta?.created_by_email || null,
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
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { code, percent_off, amount_off, currency, duration, duration_in_months, max_redemptions, expires_at, notes } = body;

    if (!code || !duration) {
      return NextResponse.json({ error: "Code and duration are required" }, { status: 400 });
    }

    if (!percent_off && !amount_off) {
      return NextResponse.json({ error: "Either percent_off or amount_off is required" }, { status: 400 });
    }

    const stripeClient = requireStripe();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const couponParams: any = {
      duration,
      name: `Promo: ${code.toUpperCase()}`,
    };

    if (percent_off) {
      couponParams.percent_off = percent_off;
    } else if (amount_off) {
      couponParams.amount_off = Math.round(amount_off * 100);
      couponParams.currency = currency || "eur";
    }

    if (duration === "repeating" && duration_in_months) {
      couponParams.duration_in_months = duration_in_months;
    }

    const coupon = await stripeClient.coupons.create(couponParams);

    // Acacia API expects flat `coupon` string. The newer clover API
    // wants `promotion: { type: "coupon", coupon: id }` instead, but
    // we pin to acacia in lib/stripe.ts so the WHOLE app uses one
    // consistent version — see the comment there for why.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promoParams: any = {
      coupon: coupon.id,
      code: code.toUpperCase(),
    };

    if (max_redemptions) {
      promoParams.max_redemptions = max_redemptions;
    }

    if (expires_at) {
      promoParams.expires_at = Math.floor(new Date(expires_at).getTime() / 1000);
    }

    const promoCode = await stripeClient.promotionCodes.create(promoParams);

    // Track this in local meta so the admin panel can show "created
    // by you" + notes. Wrapped in try/catch so a meta failure doesn't
    // poison the Stripe-successful create.
    try {
      await query(
        `INSERT INTO promo_codes_meta (code, notes, created_by_email, source)
         VALUES ($1, $2, $3, 'admin_panel')
         ON CONFLICT (code) DO UPDATE
           SET notes = EXCLUDED.notes,
               created_by_email = EXCLUDED.created_by_email,
               source = 'admin_panel',
               updated_at = NOW()`,
        [promoCode.code, notes || null, admin.email]
      );
    } catch (metaErr) {
      console.error("[admin/promo-codes] meta upsert failed:", metaErr);
    }

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

// PATCH: update local-only fields (notes). Doesn't touch Stripe.
// Body: { code, notes }
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const code = String(body?.code || "").toUpperCase();
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });
    const notes = typeof body?.notes === "string" ? body.notes.slice(0, 500) : null;

    await query(
      `INSERT INTO promo_codes_meta (code, notes, source)
       VALUES ($1, $2, 'manual_stripe')
       ON CONFLICT (code) DO UPDATE SET notes = EXCLUDED.notes, updated_at = NOW()`,
      [code, notes]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/promo-codes] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update notes" }, { status: 500 });
  }
}

// DELETE: tries to delete the promotion code from Stripe entirely.
// Stripe only allows deletion of codes with 0 redemptions; codes with
// redemptions can only be deactivated (preserves order history).
// Query params:
//   id     — Stripe promotion_code id (mandatory)
//   mode   — "delete" (default; attempts true delete) or "deactivate"
//   coupon — Stripe coupon id (optional; if provided AND no redemptions,
//            the underlying coupon is also deleted so it doesn't linger)
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const mode = searchParams.get("mode") || "delete";
    const couponId = searchParams.get("coupon");

    if (!id) {
      return NextResponse.json({ error: "Promotion code ID is required" }, { status: 400 });
    }

    const stripeClient = requireStripe();

    if (mode === "deactivate") {
      await stripeClient.promotionCodes.update(id, { active: false });
      return NextResponse.json({ success: true, mode: "deactivated" });
    }

    // True delete path. Fetch the code first to confirm it's safe.
    const pc = await stripeClient.promotionCodes.retrieve(id);
    if ((pc.times_redeemed || 0) > 0) {
      // Used codes can't be deleted; deactivate instead.
      await stripeClient.promotionCodes.update(id, { active: false });
      return NextResponse.json({
        success: true,
        mode: "deactivated",
        note: "Code had redemptions, deactivated instead of deleted.",
      });
    }

    // Stripe lets you delete a promotion code via deleting the
    // underlying coupon (which cascades). Direct promotion_code delete
    // is not an API. Use coupon delete instead. The Stripe SDK types
    // pc.coupon as missing on PromotionCode despite being present at
    // runtime — cast through to read it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pcAny = pc as any;
    const pcCoupon = pcAny?.coupon;
    const targetCouponId = couponId || (typeof pcCoupon === "string" ? pcCoupon : pcCoupon?.id);
    if (!targetCouponId) {
      // Fall back to deactivation if we can't resolve the coupon.
      await stripeClient.promotionCodes.update(id, { active: false });
      return NextResponse.json({ success: true, mode: "deactivated", note: "Coupon id missing, deactivated instead." });
    }

    await stripeClient.coupons.del(targetCouponId);

    // Clear local meta too.
    try {
      await query("DELETE FROM promo_codes_meta WHERE code = $1", [pc.code]);
    } catch (metaErr) {
      console.error("[admin/promo-codes] meta delete failed:", metaErr);
    }

    return NextResponse.json({ success: true, mode: "deleted" });
  } catch (error) {
    console.error("[admin/promo-codes] DELETE error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/promo-codes", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to delete promo code" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { requireStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Live Stripe Connect health for every photographer.
 *
 * Stripe is the source of truth here — `stripe_onboarding_complete` in our DB
 * is only a cache for bulk SQL (payout cron, admin lists) and can lag behind
 * a restriction by hours. This endpoint hits the API directly so the admin
 * board never shows a stale green.
 *
 * 63-odd `accounts.retrieve` calls take a few seconds, so the result is held
 * in memory for CACHE_MS. `?refresh=1` forces a fresh sweep.
 */

const CACHE_MS = 5 * 60 * 1000;
const CONCURRENCY = 8;

export type StripeHealthRow = {
  photographer_id: string;
  name: string;
  email: string;
  slug: string;
  stripe_email: string | null;
  account_id: string;
  is_approved: boolean;
  is_banned: boolean;
  paid_bookings: number;
  upcoming_bookings: number;
  pending_payouts: number;
  db_flag: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  disabled_reason: string | null;
  deadline: string | null;
  currently_due: string[];
  past_due: string[];
  pending_verification: string[];
  error: string | null;
  /** blocked = money can't move today · deadline = will break on `deadline`
   *  · unfinished = never completed signup · ok = nothing to do */
  severity: "blocked" | "deadline" | "unfinished" | "ok";
};

let cache: { at: number; rows: StripeHealthRow[] } | null = null;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

function classify(r: Omit<StripeHealthRow, "severity">): StripeHealthRow["severity"] {
  if (r.error) return "blocked";
  // Never got off the ground: Stripe disabled it and no money ever flowed.
  if (!r.details_submitted && r.disabled_reason) return "unfinished";
  if (!r.charges_enabled || !r.payouts_enabled || r.disabled_reason) return "blocked";
  if (r.deadline || r.past_due.length) return "deadline";
  return "ok";
}

async function sweep(): Promise<StripeHealthRow[]> {
  const stripe = requireStripe();
  const photographers = await query<{
    id: string; name: string; email: string; slug: string; account_id: string;
    is_approved: boolean; is_banned: boolean; db_flag: boolean;
    paid_bookings: string; upcoming_bookings: string; pending_payouts: string;
  }>(
    `SELECT p.id, u.name, u.email, p.slug, p.stripe_account_id AS account_id,
            COALESCE(p.is_approved, FALSE) AS is_approved,
            COALESCE(u.is_banned, FALSE) AS is_banned,
            COALESCE(p.stripe_onboarding_complete, FALSE) AS db_flag,
            (SELECT COUNT(*) FROM bookings b
              WHERE b.photographer_id = p.id AND b.payment_status = 'paid') AS paid_bookings,
            (SELECT COUNT(*) FROM bookings b
              WHERE b.photographer_id = p.id AND b.status IN ('pending','confirmed')
                AND b.shoot_date >= CURRENT_DATE) AS upcoming_bookings,
            (SELECT COUNT(*) FROM bookings b
              WHERE b.photographer_id = p.id AND b.payment_status = 'paid'
                AND COALESCE(b.payout_transferred, FALSE) = FALSE) AS pending_payouts
       FROM photographer_profiles p
       JOIN users u ON u.id = p.user_id
      WHERE p.stripe_account_id IS NOT NULL
        AND COALESCE(p.is_test, FALSE) = FALSE
      ORDER BY u.name`
  );

  const rows = await mapLimit(photographers, CONCURRENCY, async (p) => {
    const base = {
      photographer_id: p.id,
      name: p.name,
      email: p.email,
      slug: p.slug,
      account_id: p.account_id,
      is_approved: p.is_approved,
      is_banned: p.is_banned,
      db_flag: p.db_flag,
      paid_bookings: Number(p.paid_bookings),
      upcoming_bookings: Number(p.upcoming_bookings),
      pending_payouts: Number(p.pending_payouts),
    };
    try {
      const a = await stripe.accounts.retrieve(p.account_id);
      const req = a.requirements;
      const fut = a.future_requirements;
      const deadlineTs = req?.current_deadline ?? fut?.current_deadline ?? null;
      const row = {
        ...base,
        stripe_email: a.email ?? null,
        charges_enabled: !!a.charges_enabled,
        payouts_enabled: !!a.payouts_enabled,
        details_submitted: !!a.details_submitted,
        disabled_reason: req?.disabled_reason ?? null,
        deadline: deadlineTs ? new Date(deadlineTs * 1000).toISOString() : null,
        currently_due: req?.currently_due?.length ? req.currently_due : (fut?.currently_due ?? []),
        past_due: req?.past_due ?? [],
        pending_verification: req?.pending_verification ?? [],
        error: null,
      };
      return { ...row, severity: classify(row) };
    } catch (e) {
      const row = {
        ...base,
        stripe_email: null,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        disabled_reason: null,
        deadline: null,
        currently_due: [],
        past_due: [],
        pending_verification: [],
        error: e instanceof Error ? e.message : String(e),
      };
      return { ...row, severity: classify(row) };
    }
  });

  // Keep the DB cache honest while we're here — this is the same truth the
  // payout cron and the photographer checklist read.
  for (const r of rows) {
    if (r.error) continue;
    const usable = r.charges_enabled && r.payouts_enabled;
    if (usable !== r.db_flag) {
      await queryOne(
        "UPDATE photographer_profiles SET stripe_onboarding_complete = $2 WHERE id = $1 RETURNING id",
        [r.photographer_id, usable]
      ).catch(() => {});
      r.db_flag = usable;
    }
  }

  const rank = { blocked: 0, deadline: 1, unfinished: 2, ok: 3 };
  rows.sort((a, b) => {
    if (rank[a.severity] !== rank[b.severity]) return rank[a.severity] - rank[b.severity];
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    return a.name.localeCompare(b.name);
  });
  return rows;
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("refresh") === "1";
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json({ rows: cache.rows, fetched_at: new Date(cache.at).toISOString(), cached: true });
  }

  try {
    const rows = await sweep();
    cache = { at: Date.now(), rows };
    return NextResponse.json({ rows, fetched_at: new Date(cache.at).toISOString(), cached: false });
  } catch (e) {
    console.error("[admin/stripe-health] sweep failed:", e);
    // A partial view beats a blank page — serve the stale sweep if we have one.
    if (cache) {
      return NextResponse.json({
        rows: cache.rows,
        fetched_at: new Date(cache.at).toISOString(),
        cached: true,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Stripe sweep failed" }, { status: 500 });
  }
}

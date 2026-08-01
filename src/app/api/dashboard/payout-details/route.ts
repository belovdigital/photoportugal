import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { isManualPayout } from "@/lib/payout";

/**
 * Bank payout details for markets without Stripe Connect.
 *
 * Spain pays photographers by hand: the operating company is Portuguese and is
 * not registered in Spain, so Connect onboarding is not available to them. This
 * endpoint is what replaces the Connect step in their onboarding.
 *
 * IBAN is personal data. GET never returns it in full — only a masked tail, so
 * the photographer can confirm which account is on file without the value being
 * re-exposed on every dashboard load. Admin payout screens read the raw column
 * directly and are the only surface that sees it whole.
 */

/** Validate an IBAN structurally AND by its mod-97 checksum. */
export function isValidIban(raw: string): boolean {
  const s = (raw || "").replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  // Move the first four characters to the end, map letters to numbers, then
  // take mod 97 digit by digit — the whole value is far too large for Number.
  const rearranged = s.slice(4) + s.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of numeric) remainder = (remainder * 10 + Number(ch)) % 97;
  return remainder === 1;
}

function maskIban(iban: string): string {
  const s = iban.replace(/[\s-]/g, "").toUpperCase();
  if (s.length < 8) return "••••";
  return `${s.slice(0, 4)} •••• •••• ${s.slice(-4)}`;
}

async function photographerId(userId: string) {
  const row = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );
  return row?.id ?? null;
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await queryOne<{
    payout_iban: string | null;
    payout_holder: string | null;
    payout_tax_id: string | null;
    payout_details_updated_at: string | null;
  }>(
    `SELECT payout_iban, payout_holder, payout_tax_id, payout_details_updated_at
       FROM photographer_profiles WHERE user_id = $1`,
    [userId]
  );

  if (!row) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({
    configured: !!row.payout_iban,
    iban_masked: row.payout_iban ? maskIban(row.payout_iban) : null,
    holder: row.payout_holder,
    tax_id: row.payout_tax_id,
    updated_at: row.payout_details_updated_at,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Guard rather than assume: in a Connect market these columns must stay empty,
  // otherwise the approval gate could be satisfied by the wrong mechanism.
  if (!isManualPayout) {
    return NextResponse.json(
      { error: "This market pays out through Stripe Connect, not bank transfer." },
      { status: 400 }
    );
  }

  const pid = await photographerId(userId);
  if (!pid) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const iban = String(body.iban || "").replace(/[\s-]/g, "").toUpperCase();
  const holder = String(body.holder || "").trim();
  const taxId = String(body.tax_id || "").trim();

  if (!isValidIban(iban)) {
    return NextResponse.json(
      { error: "That IBAN doesn't look right — please check it and try again." },
      { status: 400 }
    );
  }
  if (holder.length < 2) {
    return NextResponse.json(
      { error: "Please enter the full name of the account holder." },
      { status: 400 }
    );
  }

  await queryOne(
    `UPDATE photographer_profiles
        SET payout_iban = $1,
            payout_holder = $2,
            payout_tax_id = NULLIF($3, ''),
            payout_details_updated_at = NOW()
      WHERE id = $4
      RETURNING id`,
    [iban, holder, taxId, pid]
  );

  return NextResponse.json({
    success: true,
    configured: true,
    iban_masked: maskIban(iban),
    holder,
    tax_id: taxId || null,
  });
}

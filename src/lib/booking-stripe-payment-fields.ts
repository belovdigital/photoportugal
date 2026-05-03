import { queryOne } from "@/lib/db";

const STRIPE_PAYMENT_COLUMNS = [
  "stripe_amount_subtotal_cents",
  "stripe_amount_paid_cents",
  "stripe_amount_discount_cents",
  "stripe_currency",
  "stripe_promo_code",
  "stripe_coupon_name",
  "stripe_coupon_percent_off",
] as const;

let cachedHasColumns: boolean | null = null;

export async function bookingStripePaymentColumnsExist(): Promise<boolean> {
  if (cachedHasColumns !== null) return cachedHasColumns;

  try {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'bookings'
         AND column_name = ANY($1)`,
      [STRIPE_PAYMENT_COLUMNS]
    );
    cachedHasColumns = Number(row?.count || 0) === STRIPE_PAYMENT_COLUMNS.length;
  } catch {
    cachedHasColumns = false;
  }

  return cachedHasColumns;
}

export async function bookingStripePaymentSelect(alias = "b"): Promise<string> {
  const safeAlias = /^[A-Za-z_][A-Za-z0-9_]*$/.test(alias) ? alias : "b";

  if (await bookingStripePaymentColumnsExist()) {
    return [
      `${safeAlias}.stripe_amount_subtotal_cents`,
      `${safeAlias}.stripe_amount_paid_cents`,
      `${safeAlias}.stripe_amount_discount_cents`,
      `${safeAlias}.stripe_currency`,
      `${safeAlias}.stripe_promo_code`,
      `${safeAlias}.stripe_coupon_name`,
      `${safeAlias}.stripe_coupon_percent_off`,
    ].join(", ");
  }

  return [
    "NULL::integer as stripe_amount_subtotal_cents",
    "NULL::integer as stripe_amount_paid_cents",
    "NULL::integer as stripe_amount_discount_cents",
    "NULL::text as stripe_currency",
    "NULL::text as stripe_promo_code",
    "NULL::text as stripe_coupon_name",
    "NULL::numeric as stripe_coupon_percent_off",
  ].join(", ");
}

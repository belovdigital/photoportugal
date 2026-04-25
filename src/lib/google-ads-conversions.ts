/**
 * Google Ads Offline Conversion Upload
 *
 * Uploads offline conversions (booking created, payment completed) to Google Ads API
 * linked to the original ad click via gclid, plus Enhanced Conversions for Leads
 * user data (hashed email/phone) for improved attribution match rate.
 *
 * Conversion actions in Google Ads account 853-315-7376:
 * - "Booking Created" — when a visitor from an ad creates a booking
 * - "Payment Completed" — when that booking is paid
 */

import { createHash } from "crypto";

const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || "8533157376";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function hashedEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return null;
  return sha256Hex(normalized);
}

// Normalise to E.164: strip spaces/dashes/parens, keep leading +, convert 00 to +.
// Skip phones without a country code — hashing a bare local number matches nothing.
function hashedPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let p = phone.replace(/[\s\-()]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (!p.startsWith("+")) return null;
  const digits = p.slice(1).replace(/\D/g, "");
  if (digits.length < 8) return null;
  return sha256Hex("+" + digits);
}

function buildUserIdentifiers(userData?: { email?: string | null; phone?: string | null }) {
  if (!userData) return undefined;
  const ids: Array<Record<string, unknown>> = [];
  const he = hashedEmail(userData.email);
  const hp = hashedPhone(userData.phone);
  if (he) ids.push({ hashed_email: he, user_identifier_source: 1 /* FIRST_PARTY */ });
  if (hp) ids.push({ hashed_phone_number: hp, user_identifier_source: 1 });
  return ids.length ? ids : undefined;
}

// These will be fetched dynamically on first use and cached
let conversionActionCache: { bookingCreated?: string; paymentCompleted?: string } = {};

async function getCustomer() {
  const { GoogleAdsApi } = require("google-ads-api");
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });
  return client.Customer({
    customer_id: CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });
}

/**
 * Look up conversion action resource names by name
 */
async function getConversionActionResourceNames(): Promise<{
  bookingCreated: string | null;
  paymentCompleted: string | null;
}> {
  if (conversionActionCache.bookingCreated && conversionActionCache.paymentCompleted) {
    return {
      bookingCreated: conversionActionCache.bookingCreated,
      paymentCompleted: conversionActionCache.paymentCompleted,
    };
  }

  try {
    const customer = await getCustomer();
    const rows = await customer.query(`
      SELECT conversion_action.resource_name, conversion_action.name
      FROM conversion_action
      WHERE conversion_action.status = 'ENABLED'
    `);

    let bookingCreated: string | null = null;
    let paymentCompleted: string | null = null;

    for (const row of rows) {
      const name = row.conversion_action?.name;
      const resourceName = row.conversion_action?.resource_name;
      if (name === "Booking Created") bookingCreated = resourceName;
      if (name === "Payment Completed") paymentCompleted = resourceName;
    }

    if (bookingCreated) conversionActionCache.bookingCreated = bookingCreated;
    if (paymentCompleted) conversionActionCache.paymentCompleted = paymentCompleted;

    return { bookingCreated, paymentCompleted };
  } catch (error) {
    console.error("[google-ads-conversions] Failed to fetch conversion actions:", error);
    return { bookingCreated: null, paymentCompleted: null };
  }
}

/**
 * Format date for Google Ads API: "yyyy-MM-dd HH:mm:ss+00:00"
 */
function formatConversionDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}+00:00`;
}

/**
 * Upload a single click conversion to Google Ads
 */
async function uploadClickConversion(params: {
  gclid: string;
  conversionActionResourceName: string;
  conversionDateTime: string;
  conversionValue?: number;
  currencyCode?: string;
  userData?: { email?: string | null; phone?: string | null };
}) {
  const customer = await getCustomer();

  const conversion: Record<string, unknown> = {
    gclid: params.gclid,
    conversion_action: params.conversionActionResourceName,
    conversion_date_time: params.conversionDateTime,
  };

  if (params.conversionValue !== undefined && params.conversionValue !== null) {
    conversion.conversion_value = params.conversionValue;
    conversion.currency_code = params.currencyCode || "EUR";
  }

  const userIdentifiers = buildUserIdentifiers(params.userData);
  if (userIdentifiers) {
    conversion.user_identifiers = userIdentifiers;
  }

  const response = await customer.conversionUploads.uploadClickConversions({
    customer_id: CUSTOMER_ID,
    conversions: [conversion],
    partial_failure: true,
  });

  return response;
}

/**
 * Upload "Booking Created" conversion when a booking with gclid is created
 */
export async function uploadBookingCreatedConversion(
  gclid: string,
  conversionValue?: number,
  userData?: { email?: string | null; phone?: string | null }
) {
  if (!gclid) return;
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    console.log("[google-ads-conversions] Skipping upload — no developer token configured");
    return;
  }

  try {
    const actions = await getConversionActionResourceNames();
    if (!actions.bookingCreated) {
      console.error("[google-ads-conversions] 'Booking Created' conversion action not found");
      return;
    }

    const result = await uploadClickConversion({
      gclid,
      conversionActionResourceName: actions.bookingCreated,
      conversionDateTime: formatConversionDateTime(new Date()),
      conversionValue: conversionValue ?? 0,
      currencyCode: "EUR",
      userData,
    });

    console.log("[google-ads-conversions] Booking Created conversion uploaded for gclid:", gclid, result?.partial_failure_error ? `(partial failure: ${result.partial_failure_error})` : "(success)");
  } catch (error) {
    console.error("[google-ads-conversions] Failed to upload Booking Created conversion:", error);
  }
}

/**
 * Upload "Payment Completed" conversion when a booking with gclid is paid
 */
export async function uploadPaymentCompletedConversion(
  gclid: string,
  conversionValue: number,
  userData?: { email?: string | null; phone?: string | null }
) {
  if (!gclid) return;
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    console.log("[google-ads-conversions] Skipping upload — no developer token configured");
    return;
  }

  try {
    const actions = await getConversionActionResourceNames();
    if (!actions.paymentCompleted) {
      console.error("[google-ads-conversions] 'Payment Completed' conversion action not found");
      return;
    }

    const result = await uploadClickConversion({
      gclid,
      conversionActionResourceName: actions.paymentCompleted,
      conversionDateTime: formatConversionDateTime(new Date()),
      conversionValue,
      currencyCode: "EUR",
      userData,
    });

    console.log("[google-ads-conversions] Payment Completed conversion uploaded for gclid:", gclid, "value:", conversionValue, result?.partial_failure_error ? `(partial failure: ${result.partial_failure_error})` : "(success)");
  } catch (error) {
    console.error("[google-ads-conversions] Failed to upload Payment Completed conversion:", error);
  }
}

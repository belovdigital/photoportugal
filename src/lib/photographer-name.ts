// Public-facing photographer name masking — "Jennifer Duarte" -> "Jennifer D."
//
// Anti-disintermediation speed bump: a CLIENT never sees a photographer's full
// surname, so they can't trivially Google / DM them and book off-platform.
// Applied at the DATA SOURCES that feed client surfaces (catalog/profile APIs,
// SSR profile page, booking page, concierge → client, client emails, the
// client's booking list, chat, the delivery gallery and the Stripe checkout
// line item) rather than at every render site.
//
// ⛔ PAYMENT DOES NOT LIFT THIS. Until 2026-08-07 it did: masking stopped once
// the booking was paid, on the reasoning that coordination needs a real name.
// Alex reversed that — a delivered gallery is exactly when a happy client is
// most tempted to book the next session direct. If you find a
// `payment_status !== 'paid'` or `!any_paid_booking` guard around a
// maskSurname call, it is a regression, not a feature.
//
// NOT applied in: the admin (full names), Telegram/ops alerts, Stripe metadata,
// photographer-self-facing surfaces (their own dashboard), or anything the
// photographer reads about themselves — including the "Hi <name>," greeting of
// their own email. Clients are never masked from anyone.
// NOTE: profile URLs/slugs still contain the full name for now — this is a
// deliberate partial measure (slug migration deferred).

export function maskSurname(name: string | null | undefined): string {
  if (!name) return name || "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "";
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return lastInitial ? `${first} ${lastInitial.toUpperCase()}.` : first;
}

/**
 * Accounts that belong to us, not to the market.
 *
 * Keyed by email rather than user id on purpose: the same person has a
 * different UUID in each market's database, so an id list can only ever be
 * right for one of them — and the list that was here before lived inside a
 * single admin route, hardcoded to Portugal's ids.
 *
 * Two things read this:
 *   - /api/link-visitor stops attaching these users to their browsing, so
 *     nothing new is recorded under their name;
 *   - the admin's Recent Visitors hides what was recorded before.
 *
 * Adding someone here does not delete their history — do that explicitly.
 */
export const INTERNAL_ACCOUNT_EMAILS = [
  "nekto.komilfo@gmail.com",    // Alex — testing from the admin
  "ekaterinabranco@gmail.com",  // Kate — testing
  "alex@belov.pt",              // admin login
] as const;

export function isInternalAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return (INTERNAL_ACCOUNT_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

/** SQL list for use inside IN (...) — already quoted and escaped. */
export function internalEmailsSqlList(): string {
  return INTERNAL_ACCOUNT_EMAILS.map((e) => `'${e.replace(/'/g, "''")}'`).join(",");
}

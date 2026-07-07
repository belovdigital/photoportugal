// Public-facing photographer name masking — "Jennifer Duarte" -> "Jennifer D."
//
// Anti-disintermediation speed bump: clients browsing the marketplace should
// not get a photographer's full surname handed to them (so they can't trivially
// Google / DM them and book off-platform). Applied at the DATA SOURCES that
// feed public surfaces (catalog/profile APIs, SSR profile page, booking page,
// concierge → client, client emails) rather than at every render site.
//
// NOT applied in: the admin (full names), photographer-self-facing surfaces
// (their own dashboard), or anything the photographer reads about themselves.
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

// Country codes sorted by length (longest first) for unambiguous matching
const COUNTRY_CODES = [
  "+966", "+972", "+971", "+380", "+353",
  "+351", "+61", "+43", "+32", "+55", "+86", "+45", "+33", "+49", "+30",
  "+91", "+39", "+81", "+60", "+52", "+31", "+64", "+47", "+48", "+65",
  "+27", "+82", "+34", "+46", "+41", "+66", "+90", "+44",
  "+7", "+1",
];

/**
 * Parse a phone string like "+351912345678" into { code: "+351", number: "912345678" }
 * Matches against known country codes (longest first) to avoid ambiguity.
 */
export function parsePhone(phone: string): { code: string; number: string } {
  for (const code of COUNTRY_CODES) {
    if (phone.startsWith(code)) {
      return { code, number: phone.slice(code.length) };
    }
  }
  // Fallback: try generic match
  const m = phone.match(/^(\+\d{1,4})(.+)$/);
  if (m) return { code: m[1], number: m[2] };
  return { code: "+351", number: phone.replace(/^\+/, "") };
}

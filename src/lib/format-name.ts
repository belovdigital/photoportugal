// Portuguese/European name particles that stay lowercase (except at start)
const LOWERCASE_PARTICLES = new Set(["da", "de", "do", "dos", "das", "di", "del", "della", "von", "van", "den", "der", "le", "la", "les", "el", "al"]);

/**
 * Capitalize a single name part, handling hyphens and apostrophes.
 * "mary-jane" → "Mary-Jane", "o'brien" → "O'Brien"
 */
function capitalizePart(part: string): string {
  // Hyphenated: capitalize each segment
  if (part.includes("-")) {
    return part.split("-").map(capitalizePart).join("-");
  }
  // Apostrophe: capitalize after it
  if (part.includes("'")) {
    return part.split("'").map(capitalizePart).join("'");
  }
  if (part.length === 0) return part;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

/**
 * Normalize a display name for clean presentation.
 * - Trims and collapses whitespace
 * - Removes trailing dots, commas, special chars
 * - Capitalizes each word (respects Portuguese particles like "da", "de")
 * - Handles ALL CAPS and all lowercase
 * - Handles hyphens and apostrophes
 */
export function normalizeName(name: string): string {
  if (!name) return "";

  // Trim, collapse multiple spaces
  let cleaned = name.trim().replace(/\s+/g, " ");

  // Remove trailing/leading punctuation (dots, commas, semicolons)
  cleaned = cleaned.replace(/^[.,;:!?]+|[.,;:!?]+$/g, "");

  // Remove stray special characters (keep letters, spaces, hyphens, apostrophes)
  cleaned = cleaned.replace(/[^a-zA-ZÀ-ÿ\s\-'.]/g, "").trim();

  if (!cleaned) return name.trim();

  const parts = cleaned.split(/\s+/);

  return parts
    .map((part, i) => {
      const lower = part.toLowerCase();
      // Keep particles lowercase unless it's the first word
      if (i > 0 && LOWERCASE_PARTICLES.has(lower)) {
        return lower;
      }
      return capitalizePart(part);
    })
    .join(" ");
}

/**
 * Format a full name for public display: "FirstName L."
 * If no last name, returns just the first name.
 * Applies normalization first.
 */
export function formatPublicName(fullName: string): string {
  const normalized = normalizeName(fullName);
  const parts = normalized.split(/\s+/);
  if (parts.length <= 1) return parts[0] || "";
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

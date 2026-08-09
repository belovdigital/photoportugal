// Portuguese/European name particles that stay lowercase (except at start)
const LOWERCASE_PARTICLES = new Set(["da", "de", "do", "dos", "das", "di", "del", "della", "von", "van", "den", "der", "le", "la", "les", "el", "al"]);

/**
 * Raise the first letter of a name part, leaving the rest exactly as typed.
 * "gabriella" → "Gabriella", "McDonald" → "McDonald" (untouched).
 */
function raiseFirstLetter(part: string): string {
  if (!part) return part;
  // A capital anywhere past the first position is deliberate — McDonald,
  // DeSanto, DesaiPatel are how those people spell their own names. Lowering
  // them was this function's worst habit.
  if (/\p{Lu}/u.test(part.slice(1))) return part;
  // Walk past anything that cannot carry a case, so a name that arrives
  // wrapped in a bracket or a quote still gets its letter raised.
  for (let i = 0; i < part.length; i++) {
    const ch = part[i];
    if (ch.toLowerCase() !== ch.toUpperCase()) {
      return part.slice(0, i) + ch.toUpperCase() + part.slice(i + 1);
    }
  }
  return part;
}

/**
 * Capitalize a single name part, handling hyphens and apostrophes.
 * "mary-jane" → "Mary-Jane", "o'brien" → "O'Brien"
 *
 * `flatten` lowercases the remainder of each part, which is only ever right
 * for a name that arrived in caps lock.
 */
function capitalizePart(part: string, flatten: boolean): string {
  // Hyphenated: capitalize each segment
  if (part.includes("-")) {
    return part.split("-").map((p) => capitalizePart(p, flatten)).join("-");
  }
  // Apostrophe: capitalize after it
  if (part.includes("'") || part.includes("’")) {
    const sep = part.includes("'") ? "'" : "’";
    return part.split(sep).map((p) => capitalizePart(p, flatten)).join(sep);
  }
  if (part.length === 0) return part;
  // Two letters in caps is an initialism, not shouting — "AJ" is how that
  // person writes their name, and "Aj" is not their name.
  if (flatten && part.length > 2) return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  return raiseFirstLetter(part);
}

/**
 * Fix only the casing and the whitespace of a name — safe to store, because
 * nothing a person typed is removed. This is what write paths use: a name is
 * somebody's identity, so the database keeps their characters and we correct
 * "kim zenglein" to "Kim Zenglein" and "MARIA SILVA" to "Maria Silva".
 */
export function capitalizeName(name: string, opts?: { fragment?: boolean }): string {
  if (!name) return "";

  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  const isShouted = cleaned === cleaned.toUpperCase() && cleaned !== cleaned.toLowerCase();

  // A surname column holds a fragment, not a whole name: "de Oliveira" and
  // "van Mil" open with a particle that stays lowercase there, even though
  // the same word would be capitalised at the start of a full name.
  const firstIsStart = !opts?.fragment;

  return cleaned
    .split(" ")
    .map((part, i) => {
      const lower = part.toLowerCase();
      // Particles are only pushed down when the person did not capitalise
      // them themselves. "Enny Das" and "Nelia De Oliveira" are surnames as
      // their owners write them; a name in caps lock carries no such intent,
      // so "MARIA DA SILVA" still becomes "Maria da Silva".
      if ((i > 0 || !firstIsStart) && LOWERCASE_PARTICLES.has(lower) && (isShouted || part === lower)) {
        return lower;
      }
      return capitalizePart(part, isShouted);
    })
    .join(" ");
}

/**
 * Normalize a display name for clean presentation.
 * - Trims and collapses whitespace
 * - Removes trailing dots, commas, special chars
 * - Raises the first letter of each word (respects particles like "da", "de")
 * - Flattens SHOUTED names — "MARIA SILVA" → "Maria Silva"
 * - Keeps deliberate inner capitals: "Ana McDonald" stays "Ana McDonald"
 * - Keeps non-Latin scripts intact: "Микита Tarasenko" keeps both halves
 * - Handles hyphens and apostrophes
 */
export function normalizeName(name: string): string {
  if (!name) return "";

  // Trim, collapse multiple spaces
  let cleaned = name.trim().replace(/\s+/g, " ");

  // Remove trailing/leading punctuation (dots, commas, semicolons)
  cleaned = cleaned.replace(/^[.,;:!?]+|[.,;:!?]+$/g, "");

  // Drop stray symbols, digits and emoji — but keep letters of EVERY script.
  // The old character class was Latin-only, so "Микита Tarasenko" came back
  // as "Tarasenko" and a Chinese given name was erased outright.
  cleaned = cleaned.replace(/[^\p{L}\p{M}\s\-'’.]/gu, "").replace(/\s+/g, " ").trim();

  if (!cleaned) return name.trim();

  return capitalizeName(cleaned);
}

/**
 * The name to greet somebody by: first word, normalized.
 * "kim zenglein" → "Kim". Falls back to `fallback` when there's nothing usable.
 */
export function firstName(fullName: string | null | undefined, fallback = ""): string {
  const normalized = normalizeName(fullName || "");
  return normalized.split(" ")[0] || fallback;
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

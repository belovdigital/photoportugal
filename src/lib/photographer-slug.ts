import { query } from "@/lib/db";

/**
 * Profile URL slugs.
 *
 * Registration used to hand out `p-<10 hex of user id>` and leave it
 * there: the readable slug only ever arrived if a Premium photographer
 * set a custom one by hand, or if someone remembered to re-run
 * scripts/backfill-pretty-slugs.mjs. Everyone who joined after the last
 * run kept a machine URL — /photographers/p-f6056755a4 — which reads as
 * spam in search results and in anything they paste to a client.
 *
 * The name-derived slug is now the default for everyone; `p-<id>` stays
 * only as the fallback for names that survive normalisation as nothing.
 * Premium's perk is choosing a CUSTOM slug, not having a readable one.
 */

/** Cyrillic → Latin, so Ukrainian/Russian names get a real URL too. */
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", ё: "e", є: "ie",
  ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh",
  ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e",
  ю: "yu", я: "ya",
};

/** Route names a profile URL must never shadow. */
export const RESERVED_SLUGS = new Set([
  "admin", "dashboard", "api", "auth", "join", "pricing", "blog",
  "faq", "about", "contact", "location", "search", "concierge",
  "find-photographer", "how-it-works", "for-photographers", "delivery",
  "book", "checkout", "signin", "signup", "logout",
]);

export function slugifyName(name: string): string {
  const latin = [...name.toLowerCase()].map((ch) => CYRILLIC[ch] ?? ch).join("");
  return latin
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** The machine slug — only for names that normalise to nothing. */
export function fallbackSlug(userId: string): string {
  return `p-${userId.replace(/-/g, "").slice(0, 10)}`;
}

async function isTaken(slug: string, exceptProfileId?: string): Promise<boolean> {
  const rows = await query<{ x: number }>(
    `SELECT 1 AS x FROM photographer_profiles WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)
     UNION ALL
     SELECT 1 AS x FROM slug_redirects WHERE old_slug = $1
     LIMIT 1`,
    [slug, exceptProfileId || null],
  );
  return rows.length > 0;
}

/**
 * Readable slug for a photographer, unique against live slugs AND past
 * redirects (reusing a retired slug would hijack an existing 301).
 * Falls back to `p-<id>` when the name yields nothing usable.
 */
export async function defaultPhotographerSlug(
  name: string | null | undefined,
  userId: string,
  exceptProfileId?: string,
): Promise<string> {
  const base = slugifyName(name || "");
  if (base.length < 3 || RESERVED_SLUGS.has(base)) return uniqueFallback(userId);

  if (!(await isTaken(base, exceptProfileId))) return base;
  for (let suffix = 2; suffix <= 20; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!(await isTaken(candidate, exceptProfileId))) return candidate;
  }
  return uniqueFallback(userId);
}

async function uniqueFallback(userId: string): Promise<string> {
  const base = fallbackSlug(userId);
  if (!(await isTaken(base))) return base;
  for (let i = 2; i <= 20; i++) {
    const candidate = `${base}-${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

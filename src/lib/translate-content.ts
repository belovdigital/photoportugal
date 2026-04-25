// Trigger-based content translator for photographer/package/review save events.
// Uses OpenAI gpt-4o-mini (cheap, fast). Only invoked at save time via fire-and-forget;
// if it fails, the original text remains as fallback (COALESCE(_loc, original) handles it).

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = "gpt-4o-mini";

const TARGET_LOCALES = ["pt", "de", "es", "fr"] as const;
type TargetLocale = (typeof TARGET_LOCALES)[number];

const LOCALE_LABEL: Record<TargetLocale, string> = {
  pt: "European Portuguese (Portugal — formal 'você' form)",
  de: "German (formal 'Sie' form)",
  es: "Spanish (peninsular Spain — formal 'usted')",
  fr: "French (formal 'vous')",
};

/**
 * Translate one set of strings into all 4 target locales in one OpenAI call.
 * Input is a flat key→value map; output is keyed by locale, with the same keys.
 *
 * Example:
 *   translateBatch({ tagline: "Capturing real family moments", bio: "With 14 years..." })
 *   → { pt: { tagline: "...", bio: "..." }, de: {...}, es: {...}, fr: {...} }
 */
export async function translateBatch(
  input: Record<string, string>,
  context: string = "photographer profile content for a tourism photography marketplace in Portugal",
): Promise<Record<TargetLocale, Record<string, string>> | null> {
  if (!OPENAI_KEY) {
    console.warn("[translate] OPENAI_API_KEY missing — skipping translation");
    return null;
  }
  const cleaned = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v && v.trim().length > 0),
  );
  if (Object.keys(cleaned).length === 0) return null;

  const systemPrompt = `You translate ${context}.
Tone: warm, professional, friendly, premium-feeling — like a trusted local guide.
For each input string, produce a translation in: ${TARGET_LOCALES.map((l) => `${l} (${LOCALE_LABEL[l]})`).join(", ")}.
Preserve placeholders like {name}, {count} verbatim. Preserve emojis. Brand names (Photo Portugal, Stripe, Google) stay in English.
Return ONLY valid JSON: { "pt": {...same keys...}, "de": {...}, "es": {...}, "fr": {...} }.`;

  const userPrompt = `Translate the following strings:\n${JSON.stringify(cleaned, null, 2)}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[translate] OpenAI HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    // Sanity check: each target locale must have all input keys
    for (const loc of TARGET_LOCALES) {
      if (!parsed[loc] || typeof parsed[loc] !== "object") {
        console.error(`[translate] missing locale ${loc} in OpenAI response`);
        return null;
      }
      for (const k of Object.keys(cleaned)) {
        if (typeof parsed[loc][k] !== "string") {
          console.error(`[translate] missing key ${loc}.${k} — falling back to original`);
          parsed[loc][k] = cleaned[k];
        }
      }
    }
    return parsed;
  } catch (e) {
    console.error("[translate] error:", e);
    return null;
  }
}

/**
 * Translate photographer tagline + bio and write to DB. Fire-and-forget — caller
 * should await but errors should not break the save flow.
 */
export async function translatePhotographerProfile(profileId: string, tagline: string | null, bio: string | null) {
  if (!tagline && !bio) return;
  const { query } = await import("@/lib/db");
  const input: Record<string, string> = {};
  if (tagline) input.tagline = tagline;
  if (bio) input.bio = bio;
  const translated = await translateBatch(input, "photographer tagline and bio for a tourism photography marketplace in Portugal");
  if (!translated) return;
  const params: (string | null)[] = [];
  const cols: string[] = [];
  for (const loc of TARGET_LOCALES) {
    if (tagline && translated[loc].tagline) {
      cols.push(`tagline_${loc} = $${params.length + 1}`);
      params.push(translated[loc].tagline);
    }
    if (bio && translated[loc].bio) {
      cols.push(`bio_${loc} = $${params.length + 1}`);
      params.push(translated[loc].bio);
    }
  }
  if (cols.length === 0) return;
  cols.push(`translations_updated_at = NOW()`, `translations_dirty = FALSE`);
  params.push(profileId);
  await query(
    `UPDATE photographer_profiles SET ${cols.join(", ")} WHERE id = $${params.length}`,
    params,
  );
}

/**
 * Translate package name + description and write to DB.
 */
export async function translatePackage(packageId: string, name: string, description: string | null) {
  const { query } = await import("@/lib/db");
  const input: Record<string, string> = { name };
  if (description) input.description = description;
  const translated = await translateBatch(input, "photography package title and description for a tourism photography marketplace in Portugal");
  if (!translated) return;
  const params: (string | null)[] = [];
  const cols: string[] = [];
  for (const loc of TARGET_LOCALES) {
    if (translated[loc].name) {
      cols.push(`name_${loc} = $${params.length + 1}`);
      params.push(translated[loc].name);
    }
    if (description && translated[loc].description) {
      cols.push(`description_${loc} = $${params.length + 1}`);
      params.push(translated[loc].description);
    }
  }
  if (cols.length === 0) return;
  cols.push(`translations_updated_at = NOW()`, `translations_dirty = FALSE`);
  params.push(packageId);
  await query(
    `UPDATE packages SET ${cols.join(", ")} WHERE id = $${params.length}`,
    params,
  );
}

/**
 * Translate review title + text and write to DB. Stores source_locale so UI can offer
 * "Show original" toggle.
 */
export async function translateReview(reviewId: string, title: string | null, text: string | null, sourceLocale: string = "en") {
  if (!title && !text) return;
  const { query } = await import("@/lib/db");
  const input: Record<string, string> = {};
  if (title) input.title = title;
  if (text) input.text = text;
  const translated = await translateBatch(input, "client review of a photographer for a tourism photography marketplace");
  if (!translated) return;
  const params: (string | null)[] = [];
  const cols: string[] = [];
  for (const loc of TARGET_LOCALES) {
    if (title && translated[loc].title) {
      cols.push(`title_${loc} = $${params.length + 1}`);
      params.push(translated[loc].title);
    }
    if (text && translated[loc].text) {
      cols.push(`text_${loc} = $${params.length + 1}`);
      params.push(translated[loc].text);
    }
  }
  if (cols.length === 0) return;
  cols.push(`source_locale = $${params.length + 1}`);
  params.push(sourceLocale);
  cols.push(`translations_updated_at = NOW()`, `translations_dirty = FALSE`);
  params.push(reviewId);
  await query(
    `UPDATE reviews SET ${cols.join(", ")} WHERE id = $${params.length}`,
    params,
  );
}

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
 *
 * The reviews table has columns text/title (canonical English) plus text_pt/de/es/fr
 * (locale variants). Source can be ANY of the 5 locales:
 *   - source='en': translate to pt/de/es/fr → text_pt/de/es/fr, keep text as-is
 *   - source='pt' (or de/es/fr): translate to the OTHER 4 → write English translation
 *     to canonical text/title, copy the original to text_<source>/title_<source>,
 *     write the rest to text_<loc>/title_<loc>
 */
export async function translateReview(reviewId: string, title: string | null, text: string | null, sourceLocale: string = "en") {
  if (!title && !text) return;
  const { query } = await import("@/lib/db");
  const ALL = ["en", "pt", "de", "es", "fr"] as const;
  type AnyLocale = (typeof ALL)[number];
  const src = (ALL.includes(sourceLocale as AnyLocale) ? sourceLocale : "en") as AnyLocale;
  const targets = ALL.filter((l) => l !== src);

  const LOCALE_LABEL_FULL: Record<AnyLocale, string> = {
    en: "English",
    pt: "European Portuguese (Portugal — formal 'você' form)",
    de: "German (formal 'Sie' form)",
    es: "Spanish (peninsular Spain — formal 'usted')",
    fr: "French (formal 'vous')",
  };

  const cleaned: Record<string, string> = {};
  if (title) cleaned.title = title;
  if (text) cleaned.text = text;

  const systemPrompt = `You translate a client review of a photographer for a tourism photography marketplace.
Tone: warm, friendly, authentic — preserve the reviewer's voice and any emojis, exclamation marks, line breaks.
Source language: ${LOCALE_LABEL_FULL[src]}. Translate each input string into: ${targets.map((l) => `${l} (${LOCALE_LABEL_FULL[l]})`).join(", ")}.
Brand names (Photo Portugal) and personal names (Isilda, Rui, etc.) stay as written.
Return ONLY valid JSON: { ${targets.map((l) => `"${l}": {...same keys...}`).join(", ")} }.`;

  if (!OPENAI_KEY) { console.warn("[translate] OPENAI_API_KEY missing — skipping review translation"); return; }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Translate the following strings:\n${JSON.stringify(cleaned, null, 2)}` },
      ],
    }),
  });
  if (!res.ok) { console.error("[translate] OpenAI HTTP", res.status, await res.text().catch(() => "")); return; }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return;
  let parsed: Record<string, Record<string, string>>;
  try { parsed = JSON.parse(content); } catch (e) { console.error("[translate] parse error:", e); return; }

  const params: (string | null)[] = [];
  const cols: string[] = [];

  for (const loc of targets) {
    const t = parsed[loc];
    if (!t || typeof t !== "object") continue;
    if (loc === "en") {
      // English goes into the canonical text/title columns (overwrite the originally-inserted source text)
      if (title && typeof t.title === "string") { cols.push(`title = $${params.length + 1}`); params.push(t.title); }
      if (text && typeof t.text === "string") { cols.push(`text = $${params.length + 1}`); params.push(t.text); }
    } else {
      if (title && typeof t.title === "string") { cols.push(`title_${loc} = $${params.length + 1}`); params.push(t.title); }
      if (text && typeof t.text === "string") { cols.push(`text_${loc} = $${params.length + 1}`); params.push(t.text); }
    }
  }

  // Preserve the original source text in its locale column (if not English)
  if (src !== "en") {
    if (title) { cols.push(`title_${src} = $${params.length + 1}`); params.push(title); }
    if (text) { cols.push(`text_${src} = $${params.length + 1}`); params.push(text); }
  }

  if (cols.length === 0) return;
  cols.push(`source_locale = $${params.length + 1}`); params.push(src);
  cols.push(`translations_updated_at = NOW()`, `translations_dirty = FALSE`);
  params.push(reviewId);
  await query(
    `UPDATE reviews SET ${cols.join(", ")} WHERE id = $${params.length}`,
    params,
  );
}

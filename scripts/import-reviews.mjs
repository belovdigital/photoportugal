#!/usr/bin/env node
/**
 * Importer for reviews collected outside the platform (Google Maps, WhatsApp,
 * Instagram DMs) — the flow that already backs 678 of the 703 reviews on PT.
 *
 * Generalizes import-instasy-reviews.mjs / import-petra-reviews.mjs, which were
 * byte-for-byte the same apart from the env path and the locale set. Pass the
 * country instead of forking the file again.
 *
 * Contract that matters:
 *   - photos go to R2 under reviews/<review_id>/<uuid>.jpg;
 *   - the canonical `text` column is ALWAYS English; per-locale columns carry
 *     the translations, which are supplied IN the JSON and written verbatim.
 *     No machine translation, rows land translations_dirty = FALSE so no
 *     sweeper ever rewrites them;
 *   - a review missing any locale aborts the run before the first INSERT. A
 *     review that renders English on /pt is exactly the leak CLAUDE.md warns
 *     about, and a half-imported set is worse than none.
 *
 * Where a reviewer wrote in a language the site serves, put their ORIGINAL text
 * in that locale's field and set sourceLocale — the profile page offers it as
 * "see original", and the reviewer's own words beat a re-translation.
 *
 * Usage: node import-reviews.mjs <pt|es> <photographer_profile_id> <reviews.json> [--dry-run] [--allow-no-photos]
 */
import fs from "fs";
import crypto from "crypto";
import pg from "pg";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const COUNTRIES = {
  // Locales are the site's active set MINUS English, which lives in `text`.
  // Keep in sync with country.locales in src/lib/country.ts.
  pt: { envPath: "/var/www/photoportugal/.env", bucket: "photoportugal-delivery", publicUrl: "https://files.photoportugal.com", locales: ["pt", "de", "es", "fr"] },
  es: { envPath: "/var/www/photospain/.env", bucket: "photospain", publicUrl: "https://files.photospain.co", locales: ["es", "de", "fr"] },
};

const [, , countryArg, photographerId, jsonPath, ...flags] = process.argv;
const DRY = flags.includes("--dry-run");
const ALLOW_NO_PHOTOS = flags.includes("--allow-no-photos");
const country = COUNTRIES[countryArg];
if (!country || !photographerId || !jsonPath) {
  console.error("Usage: node import-reviews.mjs <pt|es> <photographer_profile_id> <reviews.json> [--dry-run] [--allow-no-photos]");
  process.exit(1);
}

for (const line of fs.readFileSync(country.envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (!m) continue;
  let val = m[2];
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = val;
}

const BUCKET = process.env.R2_BUCKET || country.bucket;
const PUBLIC_URL = process.env.R2_PUBLIC_URL || country.publicUrl;
const LOCALES = country.locales;
// The languages that can appear as a per-review `sourceLocale`. Anything else
// (Hebrew, Chinese) has no column to preserve the original in, so those rows
// record "en" — the canonical English text is all we can actually show.
const SOURCE_LOCALES = new Set(["en", ...LOCALES]);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const reviews = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

// --- date handling -----------------------------------------------------------
// `createdAt` (ISO) wins when we actually know the date. Otherwise fall back to
// Google's coarse relative buckets ("4 weeks ago"); the index nudge keeps
// same-bucket reviews from collapsing onto one instant and preserves order.
function resolveTimestamp(r, index) {
  if (r.createdAt) {
    const d = new Date(r.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
    console.error(`  bad createdAt "${r.createdAt}" — aborting`);
    process.exit(1);
  }
  const m = String(r.date || "").match(/(\d+|a|an)\s+(day|week|month|year)s?\s+ago/i);
  const nudge = index * 3600e3;
  if (!m) return new Date(Date.now() - nudge);
  const n = m[1] === "a" || m[1] === "an" ? 1 : parseInt(m[1], 10);
  const ms = { day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3, year: 365 * 86400e3 }[m[2].toLowerCase()];
  return new Date(Date.now() - n * ms - nudge);
}

function cleanText(text) {
  return String(text || "")
    .replace(/\n?Translated by Google·See original \([^)]+\)\s*/gi, "")
    .replace(/\s*…\s*$/, "") // Google's trailing truncation ellipsis, not the reviewer's
    .replace(/[ \t]+$/gm, "")
    .trim();
}

async function downloadToBuffer(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      referer: "https://www.google.com/",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(new Uint8Array(await res.arrayBuffer()));
}

// Validate the whole file before touching the database.
const bad = reviews
  .map((r, i) => ({
    i,
    author: r.authorName || "(anonymous)",
    missing: LOCALES.filter((l) => !r.translations?.[l]?.trim()),
    noText: !cleanText(r.text),
    noPhotos: !ALLOW_NO_PHOTOS && !(Array.isArray(r.photos) && r.photos.length > 0),
    badSource: r.sourceLocale && !SOURCE_LOCALES.has(r.sourceLocale),
  }))
  .filter((x) => x.missing.length || x.noText || x.noPhotos || x.badSource);
if (bad.length > 0) {
  console.error(`Refusing to import — ${bad.length} incomplete row(s):`);
  for (const x of bad) {
    const why = [
      x.missing.length ? `missing ${x.missing.join(", ")}` : null,
      x.noText ? "no text" : null,
      x.noPhotos ? "no photos" : null,
      x.badSource ? "unsupported sourceLocale" : null,
    ].filter(Boolean).join("; ");
    console.error(`  #${x.i} ${x.author}: ${why}`);
  }
  process.exit(1);
}

let imported = 0, skipped = 0, photosUp = 0, photoFails = 0;

for (const [i, r] of reviews.entries()) {
  const text = cleanText(r.text);
  const author = (r.authorName || "").trim() || null;
  const rating = r.rating || 5;

  const dup = await pool.query(
    `SELECT id FROM reviews WHERE photographer_id = $1 AND text = $2 LIMIT 1`,
    [photographerId, text]
  );
  if (dup.rows.length > 0) { console.log(`  dup: ${author || "(anonymous)"}`); skipped++; continue; }

  const createdAt = resolveTimestamp(r, i).toISOString();
  const photos = Array.isArray(r.photos) ? r.photos : [];
  const sourceLocale = r.sourceLocale || "en";
  const clientCountry = (r.country || "").trim().toUpperCase().slice(0, 2) || null;

  if (DRY) {
    console.log(`  [dry] ${author || "(anonymous)"} (${rating}★, ${createdAt.slice(0, 10)}) src=${sourceLocale} photos=${photos.length} chars=${text.length}`);
    imported++;
    continue;
  }

  const localeCols = LOCALES.map((l) => `text_${l}`).join(", ");
  const localePlaceholders = LOCALES.map((_, n) => `$${9 + n}`).join(", ");
  const ins = await pool.query(
    `INSERT INTO reviews (photographer_id, rating, text, is_approved, is_verified,
                          client_name_override, photos_public, created_at, source_locale,
                          client_country_override, ${localeCols},
                          translations_updated_at, translations_dirty)
     VALUES ($1, $2, $3, TRUE, TRUE, $4, $5, $6, $7, $8, ${localePlaceholders}, NOW(), FALSE)
     RETURNING id`,
    [photographerId, rating, text, author, photos.length > 0, createdAt, sourceLocale,
     clientCountry, ...LOCALES.map((l) => r.translations[l].trim())]
  );
  const reviewId = ins.rows[0].id;

  for (const photoUrl of photos) {
    try {
      const buf = await downloadToBuffer(photoUrl);
      const jpeg = await sharp(buf)
        .rotate()
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const key = `reviews/${reviewId}/${crypto.randomUUID()}.jpg`;
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: jpeg, ContentType: "image/jpeg" }));
      await pool.query(
        `INSERT INTO review_photos (review_id, url, is_public) VALUES ($1, $2, TRUE)`,
        [reviewId, `${PUBLIC_URL}/${key}`]
      );
      photosUp++;
    } catch (err) {
      console.log(`    photo failed (${photoUrl.slice(0, 60)}): ${err.message}`);
      photoFails++;
    }
  }

  console.log(`  imported: ${author || "(anonymous)"} (${rating}★) photos=${photos.length} id=${reviewId}`);
  imported++;
}

if (!DRY) {
  await pool.query(
    `UPDATE photographer_profiles SET
      review_count = (SELECT COUNT(*) FROM reviews WHERE photographer_id = $1 AND is_approved = TRUE),
      rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE photographer_id = $1 AND is_approved = TRUE), 0)
     WHERE id = $1`,
    [photographerId]
  );
}

console.log(`\nDone [${countryArg}]. imported=${imported} skipped=${skipped} photos=${photosUp} photoFails=${photoFails}`);
await pool.end();

#!/usr/bin/env node
/**
 * One-off importer for Anastasia Aleksandrova's (instasyphoto) Google Maps reviews.
 *
 * Differs from import-google-reviews.mjs in two ways that matter:
 *   - photos go to R2 under reviews/<review_id>/<uuid>.jpg, NOT the legacy
 *     /var/www/photoportugal/uploads disk (which is on its way out);
 *   - translations are supplied IN the JSON (`translations.pt/de/es/fr`) and
 *     written straight to text_pt/de/es/fr. No machine-translation call — the
 *     rows land with translations_dirty = FALSE and are never handed to a
 *     translation sweeper.
 *
 * Every review must carry all four locales or the import refuses to run, so a
 * missing translation can't silently ship English onto a Portuguese page.
 *
 * Usage: node import-instasy-reviews.mjs <photographer_profile_id> <reviews.json> [--dry-run]
 */
import fs from "fs";
import crypto from "crypto";
import pg from "pg";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const [, , photographerId, jsonPath, ...flags] = process.argv;
const DRY = flags.includes("--dry-run");
if (!photographerId || !jsonPath) {
  console.error("Usage: node import-instasy-reviews.mjs <photographer_profile_id> <reviews.json> [--dry-run]");
  process.exit(1);
}

for (const line of fs.readFileSync("/var/www/photoportugal/.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (!m) continue;
  let val = m[2];
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = val;
}

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "0cea0c23984642ede738bd16609d2e6b";
const BUCKET = process.env.R2_BUCKET || process.env.AWS_S3_BUCKET || "photoportugal-delivery";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://files.photoportugal.com";
const LOCALES = ["pt", "de", "es", "fr"];

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const reviews = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

// --- relative date ("4 weeks ago", "Edited 6 months ago") -> timestamp --------
// Google only exposes coarse buckets, so same-bucket reviews would collapse onto
// one instant. The index nudge keeps them distinct and stably ordered.
function relativeToTimestamp(ago, index) {
  const m = String(ago || "").match(/(\d+|a|an)\s+(day|week|month|year)s?\s+ago/i);
  const nudge = index * 3600e3; // 1h apart, preserves the scrape's newest-first order
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

// Refuse the whole run on a missing locale rather than importing a partial set —
// a review that renders English on /pt is exactly the leak CLAUDE.md warns about.
const incomplete = reviews
  .map((r, i) => ({ i, author: r.authorName, missing: LOCALES.filter((l) => !r.translations?.[l]?.trim()) }))
  .filter((x) => x.missing.length > 0);
if (incomplete.length > 0) {
  console.error("Missing translations — aborting:");
  for (const x of incomplete) console.error(`  #${x.i} ${x.author}: ${x.missing.join(", ")}`);
  process.exit(1);
}

let imported = 0, skipped = 0, photosUp = 0, photoFails = 0;

for (const [i, r] of reviews.entries()) {
  const text = cleanText(r.text);
  const author = (r.authorName || "").trim() || null;
  const rating = r.rating || 5;
  if (!text) { console.log(`  skip (no text): ${author}`); skipped++; continue; }

  const dup = await pool.query(
    `SELECT id FROM reviews WHERE photographer_id = $1 AND text = $2 LIMIT 1`,
    [photographerId, text]
  );
  if (dup.rows.length > 0) { console.log(`  dup: ${author}`); skipped++; continue; }

  const createdAt = relativeToTimestamp(r.date, i).toISOString();
  const photos = Array.isArray(r.photos) ? r.photos : [];

  if (DRY) {
    console.log(`  [dry] ${author} (${rating}★, ${r.date} -> ${createdAt.slice(0, 10)}) photos=${photos.length}`);
    imported++;
    continue;
  }

  const ins = await pool.query(
    `INSERT INTO reviews (photographer_id, rating, text, is_approved, is_verified,
                          client_name_override, photos_public, created_at, source_locale,
                          text_pt, text_de, text_es, text_fr,
                          translations_updated_at, translations_dirty)
     VALUES ($1, $2, $3, TRUE, TRUE, $4, $5, $6, 'en',
             $7, $8, $9, $10, NOW(), FALSE) RETURNING id`,
    [photographerId, rating, text, author, photos.length > 0, createdAt,
     ...LOCALES.map((l) => r.translations[l].trim())]
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
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: key, Body: jpeg, ContentType: "image/jpeg",
      }));
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

  console.log(`  imported: ${author} (${rating}★) photos=${photos.length} id=${reviewId}`);
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

console.log(
  `\nDone. imported=${imported} skipped=${skipped} photos=${photosUp} photoFails=${photoFails}`
);
await pool.end();

#!/usr/bin/env node
/**
 * One-off importer for reviews scraped from Google Maps.
 * Usage: node import-google-reviews.mjs <photographer_profile_id> <reviews.json>
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pg from "pg";
import sharp from "sharp";

const [, , photographerId, jsonPath] = process.argv;
if (!photographerId || !jsonPath) {
  console.error("Usage: node import-google-reviews.mjs <photographer_profile_id> <reviews.json>");
  process.exit(1);
}

// Load env
const envPath = "/var/www/photoportugal/.env";
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (!m) continue;
  let val = m[2];
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = val;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const reviews = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const uploadsDir = `/var/www/photoportugal/uploads/reviews/${photographerId}`;
fs.mkdirSync(uploadsDir, { recursive: true });

function cleanText(text) {
  return text
    .replace(/\nTranslated by Google·See original \([^)]+\)\s*$/i, "")
    .replace(/\nTranslated by Google·See original \([^)]+\)/gi, "")
    .replace(/\s+$/g, "")
    .trim();
}

function dateAgoToTimestamp(ago) {
  // "a month ago", "3 months ago", "a year ago" → approximate Date
  const m = ago.match(/(\d+|a|an)\s+(day|week|month|year)s?\s+ago/i);
  if (!m) return new Date();
  const n = (m[1] === "a" || m[1] === "an") ? 1 : parseInt(m[1]);
  const unit = m[2].toLowerCase();
  const ms = { day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3, year: 365 * 86400e3 }[unit];
  return new Date(Date.now() - n * ms);
}

async function downloadToBuffer(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      referer: "https://www.google.com/",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const arr = new Uint8Array(await res.arrayBuffer());
  return Buffer.from(arr);
}

let imported = 0, skipped = 0;
for (const r of reviews) {
  const text = cleanText(r.text || "");
  if (!text) {
    console.log(`  skip (no text): ${r.id || "(no id)"}`);
    skipped++;
    continue;
  }
  const author = (r.authorName || "").trim() || null;
  const rating = r.rating || 5;
  const createdAt = dateAgoToTimestamp(r.date || "").toISOString();

  // Dedup by (photographer_id, text) so re-runs are safe even with empty authors
  const existing = await pool.query(
    `SELECT id FROM reviews WHERE photographer_id = $1 AND text = $2 LIMIT 1`,
    [photographerId, text]
  );
  if (existing.rows.length > 0) {
    console.log(`  dup: ${author || "(anonymous)"}`);
    skipped++;
    continue;
  }

  const hasPhotos = Array.isArray(r.photos) && r.photos.length > 0;
  const country = (r.country || "").trim().toUpperCase().slice(0, 2) || null;
  const reviewInsert = await pool.query(
    `INSERT INTO reviews (photographer_id, rating, text, is_approved, is_verified, client_name_override, photos_public, created_at, client_country_override)
     VALUES ($1, $2, $3, TRUE, TRUE, $4, $5, $6, $7) RETURNING id`,
    [photographerId, rating, text, author, hasPhotos, createdAt, country]
  );
  const reviewId = reviewInsert.rows[0].id;

  for (const photoUrl of r.photos || []) {
    try {
      const buf = await downloadToBuffer(photoUrl);
      const jpeg = await sharp(buf)
        .rotate()
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const filename = `${crypto.randomUUID()}.jpg`;
      fs.writeFileSync(path.join(uploadsDir, filename), jpeg);
      const url = `/uploads/reviews/${photographerId}/${filename}`;
      await pool.query(
        `INSERT INTO review_photos (review_id, url, is_public) VALUES ($1, $2, TRUE)`,
        [reviewId, url]
      );
      console.log(`    photo: ${url}`);
    } catch (err) {
      console.log(`    photo failed: ${err.message}`);
    }
  }
  console.log(`  imported: ${author || "(anonymous)"} (${rating}★) id=${reviewId}`);
  imported++;
}

// Recalculate photographer aggregate rating
await pool.query(
  `UPDATE photographer_profiles SET
    review_count = (SELECT COUNT(*) FROM reviews WHERE photographer_id = $1 AND is_approved = TRUE),
    rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE photographer_id = $1 AND is_approved = TRUE), 0)
   WHERE id = $1`,
  [photographerId]
);

console.log(`\nDone. imported=${imported}, skipped=${skipped}`);
await pool.end();

// Backfill clean 1200px thumbnails for delivery_photos that don't have
// one (everything uploaded before the upload-flow change). Designed to
// run on prod, against prod env (.env), in the photoportugal project
// dir so node_modules resolve.
//
// Usage:
//   ssh hetzner-pp
//   cd /var/www/photoportugal
//   node scripts/backfill-delivery-thumbnails.mjs
//
// Safe to re-run: queries only WHERE thumbnail_url IS NULL. Per-photo
// try/catch — one bad file doesn't break the run. Batches of 5 to keep
// memory + S3 bandwidth bounded.

import fs from "node:fs";
import pg from "pg";
import sharp from "sharp";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "node:crypto";

const env = Object.fromEntries(
  fs.readFileSync("/var/www/photoportugal/.env", "utf8")
    .split("\n").filter(l => l && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; })
);

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// R2 (Cloudflare) endpoint format — same configuration the app uses
// via src/lib/s3.ts. Account ID + access keys come from .env.
const R2_ACCOUNT_ID = env.R2_ACCOUNT_ID || "0cea0c23984642ede738bd16609d2e6b";
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = env.R2_BUCKET || "photoportugal-delivery";

// Accepts either the modern "s3://<key>" form OR the legacy direct
// "https://files.photoportugal.com/<key>" form (older uploads that
// predate the s3:// convention). Returns just the key part inside
// the bucket.
function s3KeyFromPath(p) {
  if (p.startsWith("s3://")) return p.slice(5);
  const m = p.match(/^https?:\/\/[^/]+\/(.+)$/);
  if (m) return m[1];
  return p;
}

async function downloadFromS3(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function uploadToS3(key, buffer, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType,
  }));
}

const BATCH_SIZE = 5;
const LIMIT = parseInt(process.argv[2] || "0", 10); // 0 = all

// Process anything with a usable url — s3:// or files.photoportugal.com.
const totalRow = await pool.query(
  `SELECT COUNT(*)::int AS c FROM delivery_photos
    WHERE media_type = 'image'
      AND thumbnail_url IS NULL
      AND (url LIKE 's3://%' OR url LIKE 'https://files.photoportugal.com/%')`
);
const totalToProcess = totalRow.rows[0].c;
console.log(`Found ${totalToProcess} delivery photos without a clean thumbnail.`);
if (LIMIT > 0) console.log(`Limiting this run to ${LIMIT} (pass 0 to process all).`);
if (totalToProcess === 0) { await pool.end(); process.exit(0); }

const queryLimit = LIMIT > 0 ? Math.min(LIMIT, totalToProcess) : totalToProcess;
const rows = (await pool.query(
  `SELECT id, booking_id, url, filename
     FROM delivery_photos
    WHERE media_type = 'image'
      AND thumbnail_url IS NULL
      AND (url LIKE 's3://%' OR url LIKE 'https://files.photoportugal.com/%')
    ORDER BY created_at DESC
    LIMIT $1`,
  [queryLimit],
)).rows;

let ok = 0, failed = 0;
const startTime = Date.now();

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(async (row) => {
    try {
      const buffer = await downloadFromS3(s3KeyFromPath(row.url));
      const thumb = await sharp(buffer)
        .rotate() // honour EXIF orientation so portrait shots don't end up landscape
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 60 })
        .toBuffer();
      const thumbKey = `delivery/${row.booking_id}/thumb_${crypto.randomUUID()}.jpg`;
      await uploadToS3(thumbKey, thumb, "image/jpeg");
      await pool.query(
        "UPDATE delivery_photos SET thumbnail_url = $1 WHERE id = $2",
        [`s3://${thumbKey}`, row.id],
      );
      ok++;
    } catch (err) {
      failed++;
      console.error(`✗ ${row.id} (${row.filename}): ${err.message}`);
    }
  }));
  const done = ok + failed;
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = done / elapsed;
  const eta = rate > 0 ? Math.round((rows.length - done) / rate) : 0;
  console.log(`  ${done}/${rows.length} (ok=${ok} failed=${failed}) — ${rate.toFixed(1)}/s, ETA ${eta}s`);
}

console.log(`\nDone. ok=${ok}  failed=${failed}  total=${rows.length}`);
await pool.end();

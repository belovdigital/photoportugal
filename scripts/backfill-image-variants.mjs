// Generate the resized WebP rungs for every photo already on R2.
//
// Reads the originals straight from the bucket, writes <name>_400.webp,
// _800.webp and _1600.webp beside them, and skips anything already done — so
// it is safe to re-run, and safe to interrupt.
//
// The serving side must not be switched on until this has finished for a
// market: a srcset rung that 404s is worse than the original we serve today.
//
// Usage, from a deployed colour directory on the market's own box:
//   cd /var/www/photoportugal-blue && node scripts/backfill-image-variants.mjs --dry-run
//   cd /var/www/photoportugal-blue && node scripts/backfill-image-variants.mjs
//   ... --prefix avatars/     # one prefix at a time
//   ... --concurrency 4       # default 4; raise only if the box is idle
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { S3Client, ListObjectsV2Command, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const onlyPrefix = args.includes("--prefix") ? args[args.indexOf("--prefix") + 1] : null;
const CONCURRENCY = args.includes("--concurrency") ? Number(args[args.indexOf("--concurrency") + 1]) : 4;

const WIDTHS = [400, 800, 1600];
const QUALITY = 82;
const PREFIXES = onlyPrefix ? [onlyPrefix] : ["portfolio/", "avatars/", "covers/"];

// Same env the app reads. Run from a deploy directory so these are present.
const ENV_FILE = process.env.ENV_FILE || "/var/www/photoportugal/.env";
const env = Object.fromEntries(
  fs.readFileSync(ENV_FILE, "utf8").split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    // @next/env truncates at '#', and so must we or the secret is wrong.
    .map((m) => [m[1], m[2].split("#")[0].trim()])
);

const BUCKET = env.R2_BUCKET || "photoportugal-delivery";
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID || "0cea0c23984642ede738bd16609d2e6b"}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

const isOriginal = (key) =>
  !/_(\d+)\.webp$/.test(key) && !/(^|\/)thumb_/.test(key) && /\.(jpe?g|png|webp)$/i.test(key);

const variantKey = (key, w) => key.replace(/\.[^.]+$/, `_${w}.webp`);

async function listAll(prefix) {
  const keys = [];
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const o of res.Contents || []) if (isOriginal(o.Key)) keys.push({ key: o.Key, size: o.Size });
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function exists(key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true; } catch { return false; }
}

async function body(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return Buffer.from(await res.Body.transformToByteArray());
}

let done = 0, written = 0, skipped = 0, failed = 0, bytesIn = 0, bytesOut = 0;

async function processOne(item) {
  const missing = [];
  for (const w of WIDTHS) {
    if (!(await exists(variantKey(item.key, w)))) missing.push(w);
  }
  if (!missing.length) { skipped++; return; }
  if (DRY) { written += missing.length; return; }

  try {
    const src = await body(item.key);
    const meta = await sharp(src).metadata();
    for (const w of missing) {
      // Never upscale: a rung wider than the original would be bytes spent on
      // nothing. The srcset still lists it; the browser just gets the same
      // pixels it would have had.
      const target = Math.min(w, meta.width || w);
      const out = await sharp(src).rotate().resize(target, null, { withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer();
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: variantKey(item.key, w), Body: out, ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }));
      written++;
      bytesOut += out.length;
    }
    bytesIn += src.length;
  } catch (e) {
    failed++;
    console.error(`  FAILED ${item.key}: ${String(e.message || e).slice(0, 120)}`);
  }
}

for (const prefix of PREFIXES) {
  const items = await listAll(prefix);
  console.log(`${prefix} — ${items.length} originals`);
  const queue = [...items];
  const started = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      await processOne(queue.shift());
      if (++done % 100 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`  ${done}/${items.length}  written:${written} skipped:${skipped} failed:${failed}  ${rate.toFixed(1)}/s`);
      }
    }
  }));
  done = 0;
}

console.log(`\n${DRY ? "--dry-run: " : ""}variants written: ${written}, already present: ${skipped}, failed: ${failed}`);
if (bytesIn) console.log(`read ${(bytesIn / 1048576).toFixed(0)} MB of originals, wrote ${(bytesOut / 1048576).toFixed(0)} MB of variants`);
process.exitCode = failed ? 1 : 0;

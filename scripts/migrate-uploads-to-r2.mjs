#!/usr/bin/env node
/**
 * One-shot migration: bulk-upload everything under /var/www/photoportugal/uploads
 * to the R2 bucket (BUCKET env), preserving relative paths so URLs in the DB
 * line up cleanly:
 *   /uploads/portfolio/abc/x.jpg  →  https://files.photoportugal.com/portfolio/abc/x.jpg
 *
 * Run on the server (where env vars are loaded). Idempotent: PutObject overwrites,
 * so re-running after a partial failure is safe.
 *
 * Skips:
 *   - The .cache/ subdir (Sharp resize cache; will be regenerated, no need to ship)
 *   - Zero-byte files (corrupt uploads)
 */
import { readdir, readFile } from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ROOT = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
const BUCKET = process.env.R2_BUCKET || "photoportugal-delivery";
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "0cea0c23984642ede738bd16609d2e6b";
const CONCURRENCY = parseInt(process.env.MIGRATE_CONCURRENCY || "20");
const DRY_RUN = process.env.DRY_RUN === "1";
const SKIP_DIRS = new Set([".cache"]);

if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  console.error("Missing R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in env");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

async function uploadOne(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const ext = path.extname(file).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  const body = await readFile(file);
  if (body.length === 0) return { rel, skipped: true, reason: "empty" };
  if (DRY_RUN) return { rel, dryRun: true, size: body.length };
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: rel,
      Body: body,
      ContentType: contentType,
      // Long-lived cache header — Cloudflare in front will respect it.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return { rel, size: body.length };
}

async function main() {
  console.log(`Scanning ${ROOT}…`);
  const files = [];
  for await (const f of walk(ROOT)) files.push(f);
  console.log(`Found ${files.length} files. Uploading to bucket=${BUCKET} concurrency=${CONCURRENCY}${DRY_RUN ? " (DRY RUN)" : ""}`);

  let done = 0;
  let failed = 0;
  let bytes = 0;
  const start = Date.now();

  // Run a fixed-size pool of workers pulling from the file list.
  let cursor = 0;
  async function worker() {
    while (cursor < files.length) {
      const i = cursor++;
      try {
        const r = await uploadOne(files[i]);
        done++;
        bytes += r.size || 0;
        if (done % 100 === 0 || done === files.length) {
          const elapsed = (Date.now() - start) / 1000;
          const rate = (done / elapsed).toFixed(1);
          const mbps = (bytes / 1024 / 1024 / elapsed).toFixed(1);
          console.log(`[${done}/${files.length}] ${rate} files/s ${mbps} MB/s failed=${failed}`);
        }
      } catch (e) {
        failed++;
        console.error(`FAIL ${files[i]}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`\nDone. uploaded=${done} failed=${failed} totalMB=${(bytes / 1024 / 1024).toFixed(1)} elapsed=${((Date.now() - start) / 1000).toFixed(0)}s`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

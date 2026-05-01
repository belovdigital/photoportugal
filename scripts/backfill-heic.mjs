#!/usr/bin/env node
/**
 * Backfill HEIC portfolio uploads → JPEG.
 *
 * Some early uploads (especially from iOS) ended up with raw .heic URLs
 * because sharp's libheif was unavailable on a previous host, and the
 * fallback path stored the original buffer. iOS apps render HEIC fine,
 * but Android (and some web image proxies) don't, so we're normalising
 * to .jpg across the board.
 *
 * Strategy: download the .heic from R2, decode + re-encode to JPEG via
 * sharp, upload to a NEW key (UUID.jpg), update DB url, leave the old
 * file in place so any cached references keep working until the CDN
 * expires them.
 */
import { Pool } from "pg";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import sharp from "sharp";
import crypto from "crypto";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    }),
);

const pool = new Pool({ connectionString: env.DATABASE_URL });
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
const PUBLIC = env.R2_PUBLIC_URL || "https://files.photoportugal.com";

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

async function processOne(row) {
  const { id, url } = row;
  const key = url.replace(`${PUBLIC}/`, "");
  const dir = key.substring(0, key.lastIndexOf("/"));

  const get = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const buf = await streamToBuffer(get.Body);

  const jpegBuf = await sharp(buf)
    .rotate()
    .resize(2000, undefined, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const newKey = `${dir}/${crypto.randomUUID()}.jpg`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: newKey,
      Body: jpegBuf,
      ContentType: "image/jpeg",
    }),
  );
  const newUrl = `${PUBLIC}/${newKey}`;

  await pool.query("UPDATE portfolio_items SET url = $1 WHERE id = $2", [newUrl, id]);
  return newUrl;
}

const { rows } = await pool.query(
  "SELECT id, url FROM portfolio_items WHERE url ILIKE '%.heic' OR url ILIKE '%.heif' ORDER BY created_at DESC",
);
console.log(`Found ${rows.length} HEIC files to convert`);

let ok = 0;
let fail = 0;
for (let i = 0; i < rows.length; i++) {
  try {
    const newUrl = await processOne(rows[i]);
    ok++;
    if (i % 20 === 0 || i === rows.length - 1) {
      console.log(`[${i + 1}/${rows.length}] ${rows[i].id} → ${newUrl.split("/").pop()}`);
    }
  } catch (err) {
    fail++;
    console.error(`[${i + 1}/${rows.length}] ${rows[i].id} FAILED:`, err.message);
  }
}

console.log(`\nDone. ${ok} converted, ${fail} failed.`);
await pool.end();

// One-off: prove the presigned-PUT path works end-to-end against R2.
// Generates a presigned URL, PUTs a 150MB random file to it, HEADs to
// confirm it landed, deletes. If this works, the production flow works.
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET || "photoportugal-delivery";
const SIZE = 150 * 1024 * 1024; // 150MB — well above CF's 100MB edge cap

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

const key = `delivery/test/presign-test-${Date.now()}.bin`;
const contentType = "application/octet-stream";

console.log(`[1/4] Generating presigned PUT URL for ${key} (${SIZE} bytes)…`);
const url = await getSignedUrl(
  s3,
  new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType, ContentLength: SIZE }),
  { expiresIn: 600 }
);
console.log("       URL host:", new URL(url).host);

console.log(`[2/4] Generating ${SIZE / 1024 / 1024}MB of random data…`);
const buf = randomBytes(SIZE);

console.log("[3/4] PUT to presigned URL…");
const t0 = Date.now();
const res = await fetch(url, {
  method: "PUT",
  headers: { "Content-Type": contentType, "Content-Length": String(SIZE) },
  body: buf,
});
const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
console.log(`       status=${res.status} in ${elapsed}s`);
if (!res.ok) {
  console.error("       FAIL body:", await res.text());
  process.exit(1);
}

console.log("[4/4] HEAD to verify the object…");
const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
console.log(`       size=${head.ContentLength}, type=${head.ContentType}`);
if (head.ContentLength !== SIZE) {
  console.error(`       FAIL: expected ${SIZE}, got ${head.ContentLength}`);
  process.exit(1);
}

await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
console.log("       cleaned up");
console.log("\nOK — 150MB presigned PUT round-trips end to end.");

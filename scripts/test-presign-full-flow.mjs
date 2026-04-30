// End-to-end test: hit our /presign and /finalize endpoints over HTTP
// exactly the way the browser does, with a 150MB random "video".
// Cleans up its own row + R2 object on success.
//
// Run: node scripts/test-presign-full-flow.mjs <booking_id> <photographer_user_id>
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import pg from "pg";

const [, , BOOKING_ID, USER_ID] = process.argv;
if (!BOOKING_ID || !USER_ID) {
  console.error("usage: node test-presign-full-flow.mjs <booking_id> <user_id>");
  process.exit(1);
}

const HOST = process.env.TEST_HOST || "https://photoportugal.com";
const SIZE = 150 * 1024 * 1024;
const SECRET = process.env.NEXTAUTH_SECRET;
if (!SECRET) { console.error("NEXTAUTH_SECRET missing"); process.exit(1); }

// Look up the user's email — Bearer-path auth re-checks ban status by id but
// `authFromRequest` returns the email from the decoded payload.
const _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows: u } = await _pool.query("SELECT email FROM users WHERE id = $1", [USER_ID]);
if (!u.length) { console.error("user not found"); process.exit(1); }
const email = u[0].email;
await _pool.end();

console.log(`[1/6] Generating Bearer token for ${email}…`);
const bearer = jwt.sign({ id: USER_ID, email, role: "photographer" }, SECRET, { expiresIn: "10m" });
const authHeader = { "Authorization": `Bearer ${bearer}` };

console.log("[2/6] POST /presign…");
const presignRes = await fetch(`${HOST}/api/bookings/${BOOKING_ID}/delivery/presign`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...authHeader },
  body: JSON.stringify({
    filename: "presign-test.mp4",
    content_type: "video/mp4",
    file_size: SIZE,
  }),
});
console.log(`       status=${presignRes.status}`);
if (!presignRes.ok) { console.error("FAIL:", await presignRes.text()); process.exit(1); }
const presign = await presignRes.json();
console.log("       got upload_url, s3_key:", presign.s3_key);

console.log(`[3/6] PUT ${SIZE / 1024 / 1024}MB to R2…`);
const buf = randomBytes(SIZE);
const t0 = Date.now();
const putRes = await fetch(presign.upload_url, {
  method: "PUT",
  headers: { "Content-Type": presign.content_type, "Content-Length": String(SIZE) },
  body: buf,
});
console.log(`       status=${putRes.status} in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
if (!putRes.ok) { console.error("FAIL:", await putRes.text()); process.exit(1); }

console.log("[4/6] POST /finalize…");
const finalizeRes = await fetch(`${HOST}/api/bookings/${BOOKING_ID}/delivery/finalize`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...authHeader },
  body: JSON.stringify({
    s3_key: presign.s3_key,
    filename: "presign-test.mp4",
    download_filename: presign.download_filename,
  }),
});
console.log(`       status=${finalizeRes.status}`);
if (!finalizeRes.ok) { console.error("FAIL:", await finalizeRes.text()); process.exit(1); }
const finalizeData = await finalizeRes.json();
const photoId = finalizeData.uploaded?.[0]?.id;
console.log("       row id:", photoId);

console.log("[5/6] Verify DB row…");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(
  `SELECT id, url, file_size, media_type FROM delivery_photos WHERE id = $1`,
  [photoId]
);
console.log("       row:", rows[0]);
if (!rows[0] || rows[0].file_size !== SIZE) {
  console.error("       FAIL: row missing or wrong size");
  process.exit(1);
}

console.log("[6/6] Cleanup (delete DB row + R2 object)…");
await pool.query(`DELETE FROM delivery_photos WHERE id = $1`, [photoId]);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET || "photoportugal-delivery", Key: presign.s3_key }));
await pool.end();
console.log("\nOK — full presign → R2 → finalize round-trip works for 150MB.");

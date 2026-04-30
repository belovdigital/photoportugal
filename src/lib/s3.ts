import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "0cea0c23984642ede738bd16609d2e6b";
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET = process.env.R2_BUCKET || "photoportugal-delivery";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://files.photoportugal.com";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
});

/**
 * Upload a file to R2.
 * Returns the S3 key (use `s3://` prefix when storing in DB).
 */
export async function uploadToS3(
  key: string,
  body: Buffer | ReadableStream,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body instanceof ReadableStream
      ? Buffer.from(await new Response(body).arrayBuffer())
      : body,
    ContentType: contentType,
  });
  await s3Client.send(command);
  return key;
}

/**
 * Get a public URL for an R2 object via custom domain.
 * No presigned URLs needed — files are served via files.photoportugal.com.
 */
export async function getPresignedUrl(
  key: string,
  _expiresIn: number = 3600
): Promise<string> {
  return `${PUBLIC_URL}/${key}`;
}

/**
 * Delete a file from R2.
 */
export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  await s3Client.send(command);
}

/**
 * Generate a short-lived presigned PUT URL so the browser can upload a
 * file directly to R2 — bypassing Cloudflare's 100MB body limit on the
 * proxy edge. The signature locks both content-type and exact byte
 * length to defeat replay/upload-bomb attacks.
 *
 * `expiresIn` is in seconds. 10 minutes is plenty for a 5GB upload on a
 * typical 50 Mbps connection (~13 min uncapped) — but for unusually slow
 * connections we keep it conservative; client can re-request a fresh URL.
 */
export async function getPresignedPutUrl(
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn: number = 60 * 15
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * HEAD an R2 object to confirm it exists. Used at finalize-time so the
 * server only writes a delivery_photos row after the browser has truly
 * uploaded the file.
 */
export async function headS3Object(key: string): Promise<{ size: number; contentType: string | null } | null> {
  try {
    const res = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return {
      size: typeof res.ContentLength === "number" ? res.ContentLength : 0,
      contentType: res.ContentType ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Stream/download an object from R2 into a Buffer. Used by background
 * thumbnail extraction for presigned video uploads — the client lifted
 * the file straight to R2, so we have to fetch it back to run ffmpeg.
 * Egress from R2 is free, so this only costs us memory + CPU.
 */
export async function downloadS3ObjectAsBuffer(key: string): Promise<Buffer> {
  const res = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!res.Body) throw new Error(`R2 object ${key} has empty body`);
  // SDK v3 returns a stream-like; the recommended idiom is Body.transformToByteArray()
  const body = res.Body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof body.transformToByteArray === "function") {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }
  // Fallback: collect chunks
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Check if a URL/path is an S3/R2 reference.
 */
export function isS3Path(urlOrPath: string): boolean {
  return urlOrPath.startsWith("s3://");
}

/**
 * Extract the key from an `s3://` path.
 * e.g. `s3://delivery/abc/photo.jpg` -> `delivery/abc/photo.jpg`
 */
export function s3KeyFromPath(s3Path: string): string {
  return s3Path.replace(/^s3:\/\//, "");
}

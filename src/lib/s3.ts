import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

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

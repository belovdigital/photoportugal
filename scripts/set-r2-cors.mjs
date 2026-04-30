// One-off: configure CORS on the R2 delivery bucket so browsers can PUT
// to presigned URLs directly. Run with `node scripts/set-r2-cors.mjs`.
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET || "photoportugal-delivery";

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
  console.error("Missing R2 env vars");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

const cors = {
  Bucket: BUCKET,
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedOrigins: [
          "https://photoportugal.com",
          "https://www.photoportugal.com",
          "http://localhost:3000",
          "http://localhost:3001",
        ],
        AllowedMethods: ["PUT", "GET", "HEAD"],
        AllowedHeaders: ["*"],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3000,
      },
    ],
  },
};

await s3.send(new PutBucketCorsCommand(cors));
console.log("CORS set. Verifying…");
const res = await s3.send(new GetBucketCorsCommand({ Bucket: BUCKET }));
console.log(JSON.stringify(res.CORSRules, null, 2));

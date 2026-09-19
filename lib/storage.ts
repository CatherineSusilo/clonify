import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

// MinIO is S3-API compatible: same SDK, just point it at the self-hosted
// endpoint and force path-style URLs (MinIO doesn't do virtual-hosted buckets).
const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;
let bucketEnsured = false;

/** A fresh MinIO instance has no buckets — create it on first use. */
async function ensureBucket() {
  if (bucketEnsured) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
  bucketEnsured = true;
}

/** Uploads a photo to S3/MinIO. Returns the object key. */
export async function uploadScanPhoto(
  scanId: string,
  file: File
): Promise<string> {
  await ensureBucket();
  const key = `scans/${scanId}/${randomUUID()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    })
  );
  return key;
}

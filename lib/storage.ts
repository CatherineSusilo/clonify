import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

async function uploadFile(key: string, file: File): Promise<string> {
  await ensureBucket();
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

/** Uploads a scan-level overview photo to S3/MinIO. Returns the object key. */
export function uploadScanPhoto(scanId: string, file: File): Promise<string> {
  return uploadFile(`scans/${scanId}/${randomUUID()}-${file.name}`, file);
}

/** Uploads a scan-level equirectangular (360°) panorama. Returns the object key. */
export function uploadScanPanorama(scanId: string, file: File): Promise<string> {
  return uploadFile(`scans/${scanId}/panorama-${randomUUID()}-${file.name}`, file);
}

/** Uploads a photo captured for a specific room. Returns the object key. */
export function uploadRoomPhoto(
  scanId: string,
  roomId: string,
  file: File
): Promise<string> {
  return uploadFile(`scans/${scanId}/rooms/${roomId}/${randomUUID()}-${file.name}`, file);
}

/** Uploads an equirectangular (360°) panorama for a room. Returns the object key. */
export function uploadRoomPanorama(
  scanId: string,
  roomId: string,
  file: File
): Promise<string> {
  return uploadFile(`scans/${scanId}/rooms/${roomId}/panorama-${randomUUID()}-${file.name}`, file);
}

/** Returns a short-lived signed URL so the browser can load a private
 * MinIO object directly, without proxying bytes through Next.js. */
export async function getPhotoUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

/** Downloads an object's bytes server-side — used to hand a stored photo to
 * an external reconstruction service (e.g. TRELLIS) that needs the file
 * content itself, not a browser-facing URL. */
export async function downloadPhoto(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

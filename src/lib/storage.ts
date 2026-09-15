import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";

// Audio files live in Cloudflare R2 (S3-compatible, public bucket, zero
// egress fees) rather than on local disk, since serverless functions don't
// share a filesystem between requests. Local tmp files are still used
// transiently — ffmpeg and music-metadata need a real file path to read/write.

const R2_BUCKET = process.env.R2_BUCKET!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

function publicUrlFor(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

function keyFromPublicUrl(url: string): string | null {
  if (!url.startsWith(R2_PUBLIC_URL + "/")) return null;
  return decodeURIComponent(url.slice(R2_PUBLIC_URL.length + 1));
}

export function tmpFilePath(prefix: string, ext: string): string {
  return path.join(os.tmpdir(), `wg-${prefix}-${randomUUID()}${ext}`);
}

export async function cleanupTmpFile(localPath: string): Promise<void> {
  await fs.rm(localPath, { force: true });
}

// Final trimmed clip, played by every visitor of the game.
export async function uploadClipBlob(localPath: string): Promise<string> {
  const buffer = await fs.readFile(localPath);
  const key = `clips/${randomUUID()}.m4a`;
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "audio/mp4",
    })
  );
  return publicUrlFor(key);
}

// Full-length originals are uploaded directly from the browser to this
// `staging/` prefix (see /api/upload-url) rather than through a server
// route — Vercel serverless functions cap request bodies at 4.5MB, which
// real audio files routinely exceed. Held between the bulk-import "analyze"
// and "import" steps; deleted as soon as a row is imported, skipped, or
// removed from review.
export function isStagingBlobUrl(url: string): boolean {
  try {
    return new URL(url).pathname.includes("/staging/");
  } catch {
    return false;
  }
}

// Issues a short-lived presigned PUT URL so the browser can upload audio
// files directly to R2, bypassing this (or any) serverless function's
// request-body size limit entirely.
export async function createStagingUploadUrl(
  ext: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const key = `staging/${randomUUID()}${ext}`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 900 }
  );
  return { uploadUrl, publicUrl: publicUrlFor(key) };
}

export async function downloadBlobToTmp(url: string, ext: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download staged file (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const localPath = tmpFilePath("staged", ext);
  await fs.writeFile(localPath, buffer);
  return localPath;
}

export async function deleteBlob(url: string): Promise<void> {
  try {
    const key = keyFromPublicUrl(url);
    if (!key) return; // not one of ours (e.g. a leftover URL from a prior storage backend)
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch {
    // best-effort cleanup — a leftover object isn't worth failing the request over
  }
}

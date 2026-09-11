import { put, del } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";

// Audio files live in Vercel Blob (public, CDN-served) rather than on local
// disk, since serverless functions don't share a filesystem between
// requests. Local tmp files are still used transiently — ffmpeg and
// music-metadata need a real file path to read/write.

export function tmpFilePath(prefix: string, ext: string): string {
  return path.join(os.tmpdir(), `wg-${prefix}-${randomUUID()}${ext}`);
}

export async function cleanupTmpFile(localPath: string): Promise<void> {
  await fs.rm(localPath, { force: true });
}

// Final trimmed clip, played by every visitor of the game.
export async function uploadClipBlob(localPath: string): Promise<string> {
  const buffer = await fs.readFile(localPath);
  const blob = await put(`clips/${randomUUID()}.m4a`, buffer, {
    access: "public",
    contentType: "audio/mp4",
  });
  return blob.url;
}

// Full-length original, held between the bulk-import "analyze" and "import"
// steps. Deleted as soon as it's imported, skipped, or removed from review.
export async function uploadStagingBlob(localPath: string, ext: string): Promise<string> {
  const buffer = await fs.readFile(localPath);
  const blob = await put(`staging/${randomUUID()}${ext}`, buffer, {
    access: "public",
  });
  return blob.url;
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
    await del(url);
  } catch {
    // best-effort cleanup — a leftover blob isn't worth failing the request over
  }
}

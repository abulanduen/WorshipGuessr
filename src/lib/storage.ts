import path from "path";
import fs from "fs/promises";

// Final trimmed clips: publicly served static files.
export const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
// Raw pre-trim uploads awaiting review/import: kept outside `public/` so full
// untrimmed tracks are never web-accessible.
export const STAGING_DIR = path.join(process.cwd(), ".data", "staging");

let ensured = false;
export async function ensureStorageDirs() {
  if (ensured) return;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(STAGING_DIR, { recursive: true });
  ensured = true;
}

export function uploadUrlFor(songId: string): string {
  return `/uploads/${songId}.m4a`;
}

export function uploadPathFor(songId: string): string {
  return path.join(UPLOADS_DIR, `${songId}.m4a`);
}

export function stagingPathFor(stagingId: string, ext: string): string {
  return path.join(STAGING_DIR, `${stagingId}${ext}`);
}

export async function findStagingFile(stagingId: string): Promise<string | null> {
  await ensureStorageDirs();
  const files = await fs.readdir(STAGING_DIR);
  const match = files.find((f) => f.startsWith(stagingId));
  return match ? path.join(STAGING_DIR, match) : null;
}

export async function deleteStagingFile(stagingId: string): Promise<void> {
  const filePath = await findStagingFile(stagingId);
  if (filePath) await fs.rm(filePath, { force: true });
}

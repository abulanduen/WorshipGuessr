import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { trimAndEncode, probeDuration } from "./ffmpeg";
import { ensureStorageDirs, uploadPathFor, uploadUrlFor, UPLOADS_DIR } from "./storage";
import { normalizeKey } from "./filename-parse";
import { CLIP_TARGET_SECONDS } from "./constants";
import type { Song } from "@/types";
import fs from "fs/promises";
import path from "path";

export class DuplicateSongError extends Error {
  constructor() {
    super("A song with this title and artist is already in the setlist");
    this.name = "DuplicateSongError";
  }
}

export async function isDuplicateSong(title: string, artist: string | null): Promise<boolean> {
  const key = normalizeKey(title, artist);
  const existing = await prisma.song.findUnique({ where: { normalizedKey: key }, select: { id: true } });
  return existing !== null;
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

export type CommitSongInput = {
  inputPath: string;
  title: string;
  artist: string | null;
  startTime: number;
  sourceDuration: number;
};

/**
 * Trims/encodes the source file into a short web-friendly clip and creates
 * the DB row. Throws DuplicateSongError (pre-check, and again on a race lost
 * against the DB's unique constraint) without leaving an orphaned clip file.
 */
export async function commitSong({ inputPath, title, artist, startTime, sourceDuration }: CommitSongInput): Promise<Song> {
  const trimmedTitle = title.trim();
  const trimmedArtist = artist?.trim() || null;
  const key = normalizeKey(trimmedTitle, trimmedArtist);

  if (await isDuplicateSong(trimmedTitle, trimmedArtist)) throw new DuplicateSongError();

  await ensureStorageDirs();
  const id = randomUUID();
  const outputPath = uploadPathFor(id);
  const clipLength = Math.min(CLIP_TARGET_SECONDS, Math.max(1, sourceDuration - startTime));

  await trimAndEncode({ inputPath, outputPath, startSeconds: startTime, durationSeconds: clipLength });
  const duration = await probeDuration(outputPath).catch(() => clipLength);

  try {
    const song = await prisma.song.create({
      data: {
        id,
        title: trimmedTitle,
        artist: trimmedArtist,
        audioUrl: uploadUrlFor(id),
        duration,
        normalizedKey: key,
      },
    });
    return { ...song, addedAt: song.addedAt.toISOString() };
  } catch (err) {
    await fs.rm(outputPath, { force: true });
    if (isUniqueConstraintError(err)) throw new DuplicateSongError();
    throw err;
  }
}

export async function deleteSongFile(audioUrl: string): Promise<void> {
  if (!audioUrl.startsWith("/uploads/")) return;
  const filePath = path.join(UPLOADS_DIR, audioUrl.replace("/uploads/", ""));
  await fs.rm(filePath, { force: true });
}

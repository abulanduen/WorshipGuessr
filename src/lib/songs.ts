import { prisma } from "./prisma";
import { trimAndEncode, probeDuration } from "./ffmpeg";
import { cleanupTmpFile, deleteBlob, tmpFilePath, uploadClipBlob } from "./storage";
import { normalizeKey } from "./filename-parse";
import { CLIP_TARGET_SECONDS } from "./constants";
import type { Song } from "@/types";

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
 * Trims/encodes the source file into a short web-friendly clip, uploads it
 * to Blob storage, and creates the DB row. Throws DuplicateSongError
 * (pre-check, and again on a race lost against the DB's unique constraint)
 * without leaving an orphaned blob.
 */
export async function commitSong({ inputPath, title, artist, startTime, sourceDuration }: CommitSongInput): Promise<Song> {
  const trimmedTitle = title.trim();
  const trimmedArtist = artist?.trim() || null;
  const key = normalizeKey(trimmedTitle, trimmedArtist);

  if (await isDuplicateSong(trimmedTitle, trimmedArtist)) throw new DuplicateSongError();

  const outputPath = tmpFilePath("clip", ".m4a");
  const clipLength = Math.min(CLIP_TARGET_SECONDS, Math.max(1, sourceDuration - startTime));

  // Attempts a trim and reports whether it actually produced playable
  // content. Some real-world files (VBR MP3s especially) report an
  // inaccurate duration, so a heuristic-picked start time can land past
  // where the actual audio content ends — ffmpeg can either error out
  // ("Conversion failed") or, worse, silently succeed with a near-empty
  // file when seeking past the end. Checking the *actual* output duration
  // catches both cases.
  let lastTrimError: string | null = null;

  async function attemptTrim(startSeconds: number, durationSeconds: number): Promise<number | null> {
    try {
      await trimAndEncode({ inputPath, outputPath, startSeconds, durationSeconds });
      const produced = await probeDuration(outputPath).catch(() => 0);
      if (produced > 0.5) return produced;
      lastTrimError = "ffmpeg produced an empty or near-empty file";
      return null;
    } catch (err) {
      lastTrimError = err instanceof Error ? err.message : String(err);
      return null;
    }
  }

  try {
    let duration = await attemptTrim(startTime, clipLength);
    if (duration === null && startTime !== 0) {
      // Fall back to the safest possible clip: from the very start.
      duration = await attemptTrim(0, Math.min(CLIP_TARGET_SECONDS, Math.max(1, sourceDuration)));
    }
    if (duration === null) {
      throw new Error(`Could not produce a playable clip from this file: ${lastTrimError ?? "unknown ffmpeg error"}`);
    }

    const audioUrl = await uploadClipBlob(outputPath);

    try {
      const song = await prisma.song.create({
        data: {
          title: trimmedTitle,
          artist: trimmedArtist,
          audioUrl,
          duration,
          normalizedKey: key,
        },
      });
      return { ...song, addedAt: song.addedAt.toISOString() };
    } catch (err) {
      await deleteBlob(audioUrl);
      if (isUniqueConstraintError(err)) throw new DuplicateSongError();
      throw err;
    }
  } finally {
    await cleanupTmpFile(outputPath);
  }
}

export async function deleteSongFile(audioUrl: string): Promise<void> {
  await deleteBlob(audioUrl);
}

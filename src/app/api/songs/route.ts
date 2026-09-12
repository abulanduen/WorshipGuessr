import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { isAuthorized } from "@/lib/auth";
import { commitSong, DuplicateSongError, deleteSongFile } from "@/lib/songs";
import { probeDuration } from "@/lib/ffmpeg";
import { suggestStartTime } from "@/lib/analyze";
import { cleanupTmpFile, deleteBlob, downloadBlobToTmp, isStagingBlobUrl } from "@/lib/storage";
import { SUPPORTED_AUDIO_EXTENSIONS } from "@/lib/constants";

// Trimming/encoding can take a while on Vercel's default 10s function limit.
export const maxDuration = 60;

export async function GET() {
  const songs = await prisma.song.findMany({ orderBy: { title: "asc" } });
  return NextResponse.json(songs.map((s) => ({ ...s, addedAt: s.addedAt.toISOString() })));
}

// Manual single-song add. The client uploads the audio file straight to Blob
// (see /api/blob-upload) and sends us just the resulting URL — never the
// file bytes — since Vercel serverless functions cap request bodies at
// 4.5MB, well under the size of a typical song.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Passcode required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const blobUrl = body?.blobUrl;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const artist = typeof body?.artist === "string" ? body.artist.trim() || null : null;
  const explicitStartTime =
    typeof body?.startTime === "number"
      ? body.startTime
      : typeof body?.startTime === "string" && body.startTime.trim() !== ""
        ? Number(body.startTime)
        : null;

  if (typeof blobUrl !== "string" || !isStagingBlobUrl(blobUrl)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const ext = path.extname(new URL(blobUrl).pathname).toLowerCase();
  if (!SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: `Unsupported audio format: ${ext || "unknown"}` }, { status: 400 });
  }

  let localPath: string | null = null;
  try {
    localPath = await downloadBlobToTmp(blobUrl, ext);
    const sourceDuration = await probeDuration(localPath);
    const startTime =
      explicitStartTime !== null && !Number.isNaN(explicitStartTime)
        ? Math.max(0, explicitStartTime)
        : await suggestStartTime(localPath, sourceDuration);
    const song = await commitSong({ inputPath: localPath, title, artist, startTime, sourceDuration });
    await deleteBlob(blobUrl);
    return NextResponse.json(song, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateSongError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to process audio file";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (localPath) await cleanupTmpFile(localPath);
  }
}

// Clear the entire setlist.
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Passcode required" }, { status: 401 });

  const songs = await prisma.song.findMany({ select: { audioUrl: true } });
  await prisma.song.deleteMany({});
  await Promise.all(songs.map((s) => deleteSongFile(s.audioUrl).catch(() => {})));

  return NextResponse.json({ ok: true, removed: songs.length });
}

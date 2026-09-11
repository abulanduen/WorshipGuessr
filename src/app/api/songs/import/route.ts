import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { isAuthorized } from "@/lib/auth";
import { cleanupTmpFile, deleteBlob, downloadBlobToTmp } from "@/lib/storage";
import { commitSong, DuplicateSongError, isDuplicateSong } from "@/lib/songs";
import { probeDuration } from "@/lib/ffmpeg";
import type { ImportRowInput, ImportRowResult } from "@/types";

// Downloading the staged original + trimming/encoding can take a while on
// Vercel's default 10s function limit.
export const maxDuration = 60;

function isStagingUrl(url: string): boolean {
  try {
    return new URL(url).pathname.includes("/staging/");
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Passcode required" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as ImportRowInput | null;
  if (!body?.stagingId || !body.title) {
    return NextResponse.json({ status: "error", reason: "Missing stagingId or title" } satisfies ImportRowResult, { status: 400 });
  }
  if (!isStagingUrl(body.stagingId)) {
    return NextResponse.json({ status: "error", reason: "Invalid stagingId" } satisfies ImportRowResult, { status: 400 });
  }

  const title = body.title.trim();
  const artist = body.artist?.trim() || null;

  let inputPath: string | null = null;
  try {
    if (await isDuplicateSong(title, artist)) {
      await deleteBlob(body.stagingId);
      return NextResponse.json({ status: "skipped", reason: "duplicate" } satisfies ImportRowResult);
    }

    const ext = path.extname(new URL(body.stagingId).pathname) || ".tmp";
    inputPath = await downloadBlobToTmp(body.stagingId, ext);

    const sourceDuration = await probeDuration(inputPath);
    const song = await commitSong({
      inputPath,
      title,
      artist,
      startTime: Math.max(0, body.startTime ?? 0),
      sourceDuration,
    });

    await deleteBlob(body.stagingId);
    return NextResponse.json({ status: "imported", song } satisfies ImportRowResult);
  } catch (err) {
    if (err instanceof DuplicateSongError) {
      await deleteBlob(body.stagingId);
      return NextResponse.json({ status: "skipped", reason: "duplicate" } satisfies ImportRowResult);
    }
    const message = err instanceof Error ? err.message : "Failed to import this song";
    return NextResponse.json({ status: "error", reason: message } satisfies ImportRowResult, { status: 500 });
  } finally {
    if (inputPath) await cleanupTmpFile(inputPath);
  }
}

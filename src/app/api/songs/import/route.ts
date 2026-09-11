import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { findStagingFile, deleteStagingFile } from "@/lib/storage";
import { commitSong, DuplicateSongError, isDuplicateSong } from "@/lib/songs";
import { probeDuration } from "@/lib/ffmpeg";
import type { ImportRowInput, ImportRowResult } from "@/types";

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Passcode required" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as ImportRowInput | null;
  if (!body?.stagingId || !body.title) {
    return NextResponse.json({ status: "error", reason: "Missing stagingId or title" } satisfies ImportRowResult, { status: 400 });
  }

  const inputPath = await findStagingFile(body.stagingId);
  if (!inputPath) {
    return NextResponse.json({ status: "error", reason: "Staged file was not found (already imported or expired)" } satisfies ImportRowResult, { status: 404 });
  }

  const title = body.title.trim();
  const artist = body.artist?.trim() || null;

  try {
    if (await isDuplicateSong(title, artist)) {
      await deleteStagingFile(body.stagingId);
      return NextResponse.json({ status: "skipped", reason: "duplicate" } satisfies ImportRowResult);
    }

    const sourceDuration = await probeDuration(inputPath);
    const song = await commitSong({
      inputPath,
      title,
      artist,
      startTime: Math.max(0, body.startTime ?? 0),
      sourceDuration,
    });

    await deleteStagingFile(body.stagingId);
    return NextResponse.json({ status: "imported", song } satisfies ImportRowResult);
  } catch (err) {
    if (err instanceof DuplicateSongError) {
      await deleteStagingFile(body.stagingId);
      return NextResponse.json({ status: "skipped", reason: "duplicate" } satisfies ImportRowResult);
    }
    const message = err instanceof Error ? err.message : "Failed to import this song";
    return NextResponse.json({ status: "error", reason: message } satisfies ImportRowResult, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { prisma } from "@/lib/prisma";
import { isAuthorized } from "@/lib/auth";
import { commitSong, DuplicateSongError, deleteSongFile } from "@/lib/songs";
import { probeDuration } from "@/lib/ffmpeg";
import { suggestStartTime } from "@/lib/analyze";
import { SUPPORTED_AUDIO_EXTENSIONS } from "@/lib/constants";

export async function GET() {
  const songs = await prisma.song.findMany({ orderBy: { title: "asc" } });
  return NextResponse.json(songs.map((s) => ({ ...s, addedAt: s.addedAt.toISOString() })));
}

// Manual single-song add: multipart form with an audio file + title/artist/startTime.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Passcode required" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const title = String(form?.get("title") ?? "").trim();
  const artist = String(form?.get("artist") ?? "").trim() || null;
  const startTimeRaw = form?.get("startTime");
  const explicitStartTime =
    typeof startTimeRaw === "string" && startTimeRaw.trim() !== "" ? Number(startTimeRaw) : null;

  if (!(file instanceof File)) return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  if (!SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: `Unsupported audio format: ${ext || "unknown"}` }, { status: 400 });
  }

  const tempPath = path.join(os.tmpdir(), `wg-manual-${randomUUID()}${ext}`);
  await fs.writeFile(tempPath, Buffer.from(await file.arrayBuffer()));

  try {
    const sourceDuration = await probeDuration(tempPath);
    const startTime =
      explicitStartTime !== null && !Number.isNaN(explicitStartTime)
        ? Math.max(0, explicitStartTime)
        : await suggestStartTime(tempPath, sourceDuration);
    const song = await commitSong({ inputPath: tempPath, title, artist, startTime, sourceDuration });
    return NextResponse.json(song, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateSongError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to process audio file" }, { status: 500 });
  } finally {
    await fs.rm(tempPath, { force: true });
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

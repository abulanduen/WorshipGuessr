import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { isAuthorized } from "@/lib/auth";
import { ensureStorageDirs, stagingPathFor, deleteStagingFile } from "@/lib/storage";
import { analyzeAudioFile } from "@/lib/analyze";
import { SUPPORTED_AUDIO_EXTENSIONS } from "@/lib/constants";
import type { AnalyzeResult } from "@/types";

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Passcode required" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing audio file" }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  if (!SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: `Unsupported audio format: ${ext || "unknown"}` }, { status: 400 });
  }

  await ensureStorageDirs();
  const stagingId = randomUUID();
  const stagedPath = stagingPathFor(stagingId, ext);

  try {
    await fs.writeFile(stagedPath, Buffer.from(await file.arrayBuffer()));
    const analysis = await analyzeAudioFile(stagedPath, file.name);

    const result: AnalyzeResult = {
      stagingId,
      fileName: file.name,
      title: analysis.title,
      artist: analysis.artist,
      titleSource: analysis.titleSource,
      suggestedStart: analysis.suggestedStart,
      duration: analysis.duration,
    };
    return NextResponse.json(result);
  } catch (err) {
    await deleteStagingFile(stagingId).catch(() => {});
    const message = err instanceof Error ? err.message : "Could not read this audio file";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

// Discard a staged file that was never imported (row removed from the review table).
export async function DELETE(req: NextRequest) {
  const stagingId = req.nextUrl.searchParams.get("stagingId");
  if (!stagingId) return NextResponse.json({ error: "Missing stagingId" }, { status: 400 });
  await deleteStagingFile(stagingId).catch(() => {});
  return NextResponse.json({ ok: true });
}

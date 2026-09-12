import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { isAuthorized } from "@/lib/auth";
import { cleanupTmpFile, deleteBlob, downloadBlobToTmp, isStagingBlobUrl } from "@/lib/storage";
import { analyzeAudioFile } from "@/lib/analyze";
import { SUPPORTED_AUDIO_EXTENSIONS } from "@/lib/constants";
import type { AnalyzeResult } from "@/types";

// Decoding + loudness analysis of a full track can take a while on Vercel's
// default 10s function limit.
export const maxDuration = 60;

// The client uploads the original file straight to Blob (see
// /api/blob-upload) and only sends us the resulting URL here — never the
// file bytes — since Vercel serverless functions cap request bodies at
// 4.5MB, well under the size of a typical song.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Passcode required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const stagingUrl = body?.stagingUrl;
  const fileName = typeof body?.fileName === "string" && body.fileName ? body.fileName : "audio";

  if (typeof stagingUrl !== "string" || !isStagingBlobUrl(stagingUrl)) {
    return NextResponse.json({ error: "Missing or invalid stagingUrl" }, { status: 400 });
  }

  const ext = path.extname(new URL(stagingUrl).pathname).toLowerCase();
  if (!SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: `Unsupported audio format: ${ext || "unknown"}` }, { status: 400 });
  }

  let localPath: string | null = null;
  try {
    localPath = await downloadBlobToTmp(stagingUrl, ext);
    const analysis = await analyzeAudioFile(localPath, fileName);

    const result: AnalyzeResult = {
      stagingId: stagingUrl,
      fileName,
      title: analysis.title,
      artist: analysis.artist,
      titleSource: analysis.titleSource,
      suggestedStart: analysis.suggestedStart,
      duration: analysis.duration,
    };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read this audio file";
    return NextResponse.json({ error: message }, { status: 422 });
  } finally {
    if (localPath) await cleanupTmpFile(localPath);
  }
}

// Discard a staged file that was never imported (row removed from the review table).
export async function DELETE(req: NextRequest) {
  const stagingId = req.nextUrl.searchParams.get("stagingId");
  if (!stagingId) return NextResponse.json({ error: "Missing stagingId" }, { status: 400 });
  if (!isStagingBlobUrl(stagingId)) return NextResponse.json({ error: "Invalid stagingId" }, { status: 400 });
  await deleteBlob(stagingId);
  return NextResponse.json({ ok: true });
}

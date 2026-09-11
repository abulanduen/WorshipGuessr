import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";

// Issues short-lived client tokens so the browser can upload audio files
// directly to Blob storage, bypassing this (or any) serverless function's
// request-body size limit entirely. The actual analyze/import routes then
// work off the resulting blob URL rather than raw file bytes.
export async function POST(req: NextRequest) {
  // Checked here (not inside onBeforeGenerateToken) so a real passcode
  // failure is distinguishable from any other server-side error below.
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Passcode required" }, { status: 401 });
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "audio/mpeg",
          "audio/mp4",
          "audio/x-m4a",
          "audio/aac",
          "audio/wav",
          "audio/x-wav",
          "audio/flac",
          "audio/ogg",
          "audio/opus",
          "audio/x-ms-wma",
          "audio/aiff",
          "audio/x-aiff",
          // Some browsers/OSes report generic or missing MIME types for
          // less common audio formats — allow it and let ffmpeg sort it out.
          "application/octet-stream",
        ],
        addRandomSuffix: true,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    // Logged server-side (visible in Vercel's Runtime Logs) since the Blob
    // client SDK only ever surfaces a generic "Failed to retrieve the
    // client token" to the browser regardless of what actually broke here —
    // e.g. a missing/misconfigured BLOB_READ_WRITE_TOKEN in this environment.
    console.error("[blob-upload] token generation failed:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

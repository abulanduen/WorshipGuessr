import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";

// Issues short-lived client tokens so the browser can upload audio files
// directly to Blob storage, bypassing this (or any) serverless function's
// request-body size limit entirely. The actual analyze/import routes then
// work off the resulting blob URL rather than raw file bytes.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        if (!isAuthorized(req)) throw new Error("Passcode required");
        return {
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
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload authorization failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { createStagingUploadUrl } from "@/lib/storage";

// Issues a presigned R2 PUT URL so the browser can upload audio files
// directly to storage, bypassing this (or any) serverless function's
// request-body size limit entirely. The actual analyze/import routes then
// work off the resulting public URL rather than raw file bytes.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Passcode required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ext = typeof body?.ext === "string" ? body.ext : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "application/octet-stream";

  try {
    const { uploadUrl, publicUrl } = await createStagingUploadUrl(ext, contentType);
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("[upload-url] presign failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create upload URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

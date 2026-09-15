// Uploads a file straight from the browser to storage — bypasses this (or
// any) serverless function's request-body size cap, which real audio files
// routinely exceed. Gets a short-lived presigned PUT URL from the server,
// then PUTs directly to it.
export async function uploadStagingFile(file: File, signal?: AbortSignal): Promise<string> {
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const contentType = file.type || "application/octet-stream";

  const res = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ext, contentType }),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to get upload URL");
  }
  const { uploadUrl, publicUrl } = (await res.json()) as { uploadUrl: string; publicUrl: string };

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
    signal,
  });
  if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

  return publicUrl;
}

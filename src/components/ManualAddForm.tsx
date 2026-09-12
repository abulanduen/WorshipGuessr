"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useAuth } from "@/lib/auth-context";

export function ManualAddForm({ onAdded }: { onAdded: () => void }) {
  const { authorizedFetch } = useAuth();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [startTime, setStartTime] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      // Upload straight from the browser to Blob storage — bypasses the
      // serverless function's request-body size cap, which real audio files
      // routinely exceed.
      setProgressLabel("Uploading…");
      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
      const blob = await upload(`staging/${crypto.randomUUID()}${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
        multipart: true,
      });

      setProgressLabel("Trimming & encoding…");
      const res = await authorizedFetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobUrl: blob.url,
          title: title.trim(),
          artist: artist.trim(),
          startTime: startTime.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to add song");
      }
      setTitle("");
      setArtist("");
      setStartTime("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add song");
    } finally {
      setSubmitting(false);
      setProgressLabel(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="animate-scale-in rounded-xl border border-line bg-surface-2 p-4">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-gold"
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artist (optional)"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-gold"
        />
      </div>
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1fr_auto]">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-dim file:mr-3 file:rounded-md file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink"
        />
        <input
          type="number"
          min={0}
          step={0.1}
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          placeholder="Start (s)"
          title="Optional manual clip start time in seconds"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-gold sm:w-28"
        />
      </div>
      <p className="mt-2 text-[11px] text-ink-mute">
        Leave start time blank to auto-pick a clip near the loudest section.
      </p>
      {error && <p className="animate-rise-in mt-2 text-xs text-bad">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !file || !title.trim()}
        className="mt-3 w-full rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-ink transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
      >
        {submitting ? progressLabel ?? "Adding…" : "Add song"}
      </button>
    </form>
  );
}

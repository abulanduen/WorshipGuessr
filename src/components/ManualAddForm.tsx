"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export function ManualAddForm({ onAdded }: { onAdded: () => void }) {
  const { authorizedFetch } = useAuth();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [startTime, setStartTime] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", title.trim());
      form.set("artist", artist.trim());
      if (startTime.trim()) form.set("startTime", startTime.trim());

      const res = await authorizedFetch("/api/songs", { method: "POST", body: form });
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
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-line bg-surface-2 p-4">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-gold"
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artist (optional)"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-gold"
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
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-gold sm:w-28"
        />
      </div>
      <p className="mt-2 text-[11px] text-ink-mute">
        Leave start time blank to auto-pick a clip near the loudest section.
      </p>
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !file || !title.trim()}
        className="mt-3 w-full rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add song"}
      </button>
    </form>
  );
}
